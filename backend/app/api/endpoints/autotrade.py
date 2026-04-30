"""
AutoTrade endpoint – watches model signals and auto-executes orders
when price conditions are met.

State machine per entry:
    WATCHING  → trigger condition met → TRIGGERED (entry order submitted)
    TRIGGERED → entry order confirmed filled → ACTIVE  (entry_price set from fill)
    ACTIVE    → exit condition met → CLOSING (exit order submitted)
    CLOSING   → exit order confirmed filled → FILLED (P&L locked from actual fills)
    Any stage → unrecoverable exception → ERROR
    Any stage → user cancels → CANCELLED
"""
import logging
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import asyncio
import uuid
from datetime import datetime, timedelta

from app.data import alpaca_client as ac
from app.trading import order_manager as om

logger = logging.getLogger("autotrade")

router = APIRouter()

_SCAN_INTERVAL = int(os.environ.get("AUTOTRADE_SCAN_INTERVAL_SEC", "5"))
_DEFAULT_SIGNAL_QTY = float(os.environ.get("AUTOTRADE_DEFAULT_QTY", "1"))


class AutoTradeEntry(BaseModel):
    id: str
    symbol: str
    direction: str              # BULLISH | BEARISH
    entry_trigger_price: float
    target_price: float
    stop_loss: float
    qty: float
    time_horizon_minutes: int = 240
    conviction_score: float
    status: str                 # WATCHING | TRIGGERED | ACTIVE | CLOSING | FILLED | CANCELLED | ERROR
    current_price: Optional[float] = None
    entry_price: Optional[float] = None  
    exit_price: Optional[float] = None   
    order_id: Optional[str] = None       
    exit_order_id: Optional[str] = None  
    pnl: Optional[float] = None
    triggered_at: Optional[str] = None
    expires_at: Optional[str] = None
    close_reason: Optional[str] = None
    filled_at: Optional[str] = None
    error_msg: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class AddAutoTradeRequest(BaseModel):
    symbol: str
    direction: str
    entry_trigger_price: Optional[float] = None
    target_price: float
    stop_loss: float
    qty: float
    time_horizon_minutes: int = Field(default=240, ge=1, le=10080)
    conviction_score: float = 75.0


_watchlist: Dict[str, AutoTradeEntry] = {}
_auto_enabled: bool = True
_scan_task: Optional[asyncio.Task] = None

_ACTIVE_STATUSES = {'WATCHING', 'TRIGGERED', 'ACTIVE', 'CLOSING'}


async def _price_scan_loop():
    """Background task: runs the state machine for every active AutoTrade entry."""
    sync_counter = 0
    while True:
        try:
            await asyncio.sleep(_SCAN_INTERVAL)
            if not _auto_enabled:
                continue
            
            # Fetch new signals periodically (e.g. every 30 seconds if interval is 5s)
            sync_counter += _SCAN_INTERVAL
            if sync_counter >= 30:
                try:
                    sync_signals_to_watchlist()
                    logger.info("Auto-synced new signals into watchlist.")
                except Exception as e:
                    logger.error(f"Error auto-syncing signals: {e}")
                sync_counter = 0

            try:
                clock = ac.get_clock()
                market_open = clock.get("is_open", False)
            except Exception as clock_err:
                logger.warning(f"Failed to fetch market clock: {clock_err}")
                market_open = False

            for entry_id, entry in list(_watchlist.items()):
                if entry.status not in _ACTIVE_STATUSES:
                    continue
                try:
                    await _process_entry(entry, market_open)
                except Exception as exc:
                    logger.error(f"AutoTrade {entry.id} ({entry.symbol}) unhandled error: {exc}")
                    entry.status = 'ERROR'
                    entry.error_msg = str(exc)

        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error(f"Scan loop outer error: {exc}")
            await asyncio.sleep(10)


async def _process_entry(entry: AutoTradeEntry, market_open: bool):

    if entry.status == 'WATCHING':
        quote = ac.get_latest_quote(entry.symbol)
        price = quote.get('ask') or quote.get('bid')
        if not price:
            return
        entry.current_price = price

        # Make trigger condition more generous (0.5% tolerance) to ensure it trades often for demonstration
        should_trigger = (
            (entry.direction == 'BULLISH' and price <= entry.entry_trigger_price * 1.005) or
            (entry.direction == 'BEARISH' and price >= entry.entry_trigger_price * 0.995)
        )
        if not should_trigger:
            return

        if not market_open:
            logger.info(f"AutoTrade {entry.id}: trigger met for {entry.symbol} but market is closed — skipping")
            return

        side = 'buy' if entry.direction == 'BULLISH' else 'sell'
        order = om.submit_order(
            symbol=entry.symbol,
            qty=entry.qty,
            side=side,
            order_type='market',
            time_in_force='day',
        )
        now = datetime.utcnow()
        entry.order_id = order.get('id') or order.get('order_id')
        entry.triggered_at = now.isoformat()
        entry.expires_at = (now + timedelta(minutes=entry.time_horizon_minutes)).isoformat()
        entry.status = 'TRIGGERED'
        logger.info(f"AutoTrade {entry.id}: entry order {entry.order_id} submitted for {entry.symbol}")

    elif entry.status == 'TRIGGERED':
        if not entry.order_id:
            entry.status = 'ERROR'
            entry.error_msg = 'No entry order_id stored'
            return

        alpaca_order = ac.get_order_by_id(entry.order_id)
        alpaca_status = alpaca_order.get('status', '')

        if alpaca_status == 'filled':
            entry.entry_price = alpaca_order.get('filled_avg_price')
            if not entry.entry_price:
                # Fall back to last known quote if somehow missing
                quote = ac.get_latest_quote(entry.symbol)
                entry.entry_price = quote.get('ask') or quote.get('bid')
            entry.status = 'ACTIVE'
            logger.info(f"AutoTrade {entry.id}: entry filled @ {entry.entry_price} for {entry.symbol}")

        elif alpaca_status in ('canceled', 'cancelled', 'expired', 'rejected'):
            entry.status = 'ERROR'
            entry.error_msg = f'Entry order {alpaca_status}'
            logger.warning(f"AutoTrade {entry.id}: entry order {alpaca_status} for {entry.symbol}")

    elif entry.status == 'ACTIVE' and entry.entry_price:
        quote = ac.get_latest_quote(entry.symbol)
        price = quote.get('ask') or quote.get('bid')
        if not price:
            return
        entry.current_price = price

        now = datetime.utcnow()
        expires_at = datetime.fromisoformat(entry.expires_at) if entry.expires_at else None

        take_profit_hit = (
            (entry.direction == 'BULLISH' and price >= entry.target_price) or
            (entry.direction == 'BEARISH' and price <= entry.target_price)
        )
        stop_loss_hit = (
            (entry.direction == 'BULLISH' and price <= entry.stop_loss) or
            (entry.direction == 'BEARISH' and price >= entry.stop_loss)
        )
        time_horizon_hit = bool(expires_at and now >= expires_at)

        if not (take_profit_hit or stop_loss_hit or time_horizon_hit):
            return

        if not market_open:
            logger.info(f"AutoTrade {entry.id}: exit condition met for {entry.symbol} but market is closed — waiting")
            return

        close_side = 'sell' if entry.direction == 'BULLISH' else 'buy'
        exit_order = om.submit_order(
            symbol=entry.symbol,
            qty=entry.qty,
            side=close_side,
            order_type='market',
            time_in_force='day',
        )
        entry.exit_order_id = exit_order.get('id') or exit_order.get('order_id')
        entry.close_reason = (
            'TAKE_PROFIT' if take_profit_hit else
            'STOP_LOSS'   if stop_loss_hit   else
            'TIME_HORIZON'
        )
        entry.status = 'CLOSING'
        logger.info(f"AutoTrade {entry.id}: exit order {entry.exit_order_id} submitted ({entry.close_reason})")

    elif entry.status == 'CLOSING':
        if not entry.exit_order_id:
            entry.status = 'ERROR'
            entry.error_msg = 'No exit_order_id stored'
            return

        exit_alpaca = ac.get_order_by_id(entry.exit_order_id)
        exit_status = exit_alpaca.get('status', '')

        if exit_status == 'filled':
            entry.exit_price = exit_alpaca.get('filled_avg_price')
            if entry.exit_price and entry.entry_price:
                multiplier = 1 if entry.direction == 'BULLISH' else -1
                entry.pnl = round(
                    (entry.exit_price - entry.entry_price) * multiplier * entry.qty, 2
                )
            entry.status = 'FILLED'
            entry.filled_at = datetime.utcnow().isoformat()
            logger.info(
                f"AutoTrade {entry.id}: exit filled @ {entry.exit_price} "
                f"P&L={entry.pnl} for {entry.symbol}"
            )

        elif exit_status in ('canceled', 'cancelled', 'expired', 'rejected'):
            entry.status = 'ERROR'
            entry.error_msg = f'Exit order {exit_status}'
            logger.warning(f"AutoTrade {entry.id}: exit order {exit_status} for {entry.symbol}")


def start_autotrade_scanner():
    global _scan_task
    _scan_task = asyncio.create_task(_price_scan_loop())
    return _scan_task


def stop_autotrade_scanner():
    if _scan_task:
        _scan_task.cancel()


@router.get("/status")
def get_autotrade_status():
    return {
        "enabled": _auto_enabled,
        "watching":   sum(1 for e in _watchlist.values() if e.status == 'WATCHING'),
        "triggered":  sum(1 for e in _watchlist.values() if e.status == 'TRIGGERED'),
        "active":     sum(1 for e in _watchlist.values() if e.status == 'ACTIVE'),
        "closing":    sum(1 for e in _watchlist.values() if e.status == 'CLOSING'),
        "filled":     sum(1 for e in _watchlist.values() if e.status == 'FILLED'),
        "error":      sum(1 for e in _watchlist.values() if e.status == 'ERROR'),
        "total":      len(_watchlist),
    }


@router.get("/watchlist")
def list_watchlist() -> List[dict]:
    return [e.model_dump() for e in sorted(_watchlist.values(), key=lambda x: x.created_at, reverse=True)]


@router.post("/watchlist")
def add_to_watchlist(payload: AddAutoTradeRequest):
    direction = payload.direction.upper()
    if direction not in {"BULLISH", "BEARISH"}:
        raise HTTPException(status_code=400, detail="direction must be BULLISH or BEARISH")

    if direction == "BULLISH" and payload.stop_loss >= payload.target_price:
        raise HTTPException(status_code=400, detail="For BULLISH trades, stop_loss must be lower than target_price")
    if direction == "BEARISH" and payload.stop_loss <= payload.target_price:
        raise HTTPException(status_code=400, detail="For BEARISH trades, stop_loss must be higher than target_price")

    entry_trigger = payload.entry_trigger_price
    if entry_trigger is None:
        quote = ac.get_latest_quote(payload.symbol)
        live_price = quote.get('ask') or quote.get('bid')
        if not live_price:
            raise HTTPException(
                status_code=503,
                detail=f"Could not fetch live price for {payload.symbol}. Set entry_trigger_price explicitly."
            )
        entry_trigger = float(live_price)

    entry = AutoTradeEntry(
        id=f"at_{uuid.uuid4().hex[:8]}",
        symbol=payload.symbol.upper(),
        direction=direction,
        entry_trigger_price=float(entry_trigger),
        target_price=payload.target_price,
        stop_loss=payload.stop_loss,
        qty=payload.qty,
        time_horizon_minutes=payload.time_horizon_minutes,
        conviction_score=payload.conviction_score,
        status='WATCHING',
    )
    _watchlist[entry.id] = entry
    return entry.model_dump()


@router.delete("/watchlist/{entry_id}")
def remove_from_watchlist(entry_id: str):
    if entry_id not in _watchlist:
        raise HTTPException(status_code=404, detail="AutoTrade entry not found")
    _watchlist[entry_id].status = 'CANCELLED'
    return {"cancelled": entry_id}


@router.post("/toggle")
def toggle_autotrade():
    global _auto_enabled
    _auto_enabled = not _auto_enabled
    return {"enabled": _auto_enabled}


@router.post("/sync-signals")
def sync_signals_to_watchlist():
    """Pull the latest signals and add any new ones to the watchlist (idempotent)."""
    from app.api.endpoints.signals import generate_all_signals
    signals = generate_all_signals()
    added = []
    skipped = []
    existing_symbols = {e.symbol for e in _watchlist.values() if e.status == 'WATCHING'}
    for sig in signals:
        sym = sig.get('symbol', '').upper()
        if not sym or sym in existing_symbols:
            continue

        entry_trigger = sig.get('current_price') or sig.get('entry_trigger_price')
        target = sig.get('target_price', 0)
        stop = sig.get('stop_loss', 0)
        qty = float(sig.get('qty', _DEFAULT_SIGNAL_QTY))

        if not entry_trigger or entry_trigger <= 0:
            skipped.append(sym)
            logger.warning(f"sync-signals: skipping {sym} — no valid entry_trigger_price")
            continue

        entry = AutoTradeEntry(
            id=f"at_{uuid.uuid4().hex[:8]}",
            symbol=sym,
            direction=sig.get('direction', 'BULLISH').upper(),
            entry_trigger_price=float(entry_trigger),
            target_price=float(target),
            stop_loss=float(stop),
            qty=qty,
            time_horizon_minutes=int(sig.get('time_horizon_minutes', 240)),
            conviction_score=float(sig.get('conviction_score', 75.0)),
            status='WATCHING',
        )
        _watchlist[entry.id] = entry
        added.append(sym)

    return {
        "synced": added,
        "skipped": skipped,
        "total_watching": sum(1 for e in _watchlist.values() if e.status == 'WATCHING'),
    }
