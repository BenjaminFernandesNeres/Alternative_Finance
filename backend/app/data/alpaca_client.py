"""
Alpaca REST client – wraps alpaca-py SDK for market data + trading operations.
Loads credentials from environment variables.
"""
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import (
    MarketOrderRequest, LimitOrderRequest, StopOrderRequest, StopLimitOrderRequest
)
from alpaca.trading.enums import OrderSide, TimeInForce, QueryOrderStatus
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import (
    StockBarsRequest, StockLatestQuoteRequest, StockLatestTradeRequest,
    StockSnapshotRequest
)
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

# Load .env from project root: backend/app/data/ → backend/app/ → backend/ → WarSignals/
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env'))

API_KEY    = os.environ.get("ALPACA_API_KEY", "")
SECRET_KEY = os.environ.get("ALPACA_SECRET_KEY", "")
BASE_URL   = os.environ.get("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

# ── Clients ───────────────────────────────────────────────────────────────────
trading_client = TradingClient(API_KEY, SECRET_KEY, paper=("paper" in BASE_URL))
data_client    = StockHistoricalDataClient(API_KEY, SECRET_KEY)


# ── Account & Portfolio ───────────────────────────────────────────────────────

def get_account() -> dict:
    """Return account info: equity, cash, buying_power, day's P&L, etc."""
    acct = trading_client.get_account()
    return {
        "id": str(acct.id),
        "equity": float(acct.equity),
        "cash": float(acct.cash),
        "buying_power": float(acct.buying_power),
        "portfolio_value": float(acct.portfolio_value),
        "last_equity": float(acct.last_equity),
        "daily_pnl": float(acct.equity) - float(acct.last_equity),
        "daily_pnl_pct": (
            (float(acct.equity) - float(acct.last_equity)) / float(acct.last_equity) * 100
            if float(acct.last_equity) > 0 else 0.0
        ),
        "currency": acct.currency,
        "status": str(acct.status),
        "pattern_day_trader": acct.pattern_day_trader,
        "daytrade_count": acct.daytrade_count,
    }


def get_positions() -> list:
    """Return all open positions with P&L info."""
    positions = trading_client.get_all_positions()
    result = []
    for p in positions:
        result.append({
            "symbol": p.symbol,
            "qty": float(p.qty),
            "side": str(p.side),
            "avg_entry_price": float(p.avg_entry_price),
            "current_price": float(p.current_price) if p.current_price else None,
            "market_value": float(p.market_value) if p.market_value else None,
            "cost_basis": float(p.cost_basis),
            "unrealized_pl": float(p.unrealized_pl) if p.unrealized_pl else None,
            "unrealized_plpc": float(p.unrealized_plpc) * 100 if p.unrealized_plpc else None,
            "change_today": float(p.change_today) if p.change_today else None,
        })
    return result


# ── Market Data ───────────────────────────────────────────────────────────────

def get_bars(symbol: str, timeframe: str = "1Day", limit: int = 60) -> list:
    """
    Fetch OHLCV bars for a symbol.
    timeframe: '1Min', '5Min', '15Min', '1Hour', '1Day'
    """
    tf_map = {
        "1Min":  TimeFrame(1, TimeFrameUnit.Minute),
        "5Min":  TimeFrame(5, TimeFrameUnit.Minute),
        "15Min": TimeFrame(15, TimeFrameUnit.Minute),
        "1Hour": TimeFrame(1, TimeFrameUnit.Hour),
        "1Day":  TimeFrame(1, TimeFrameUnit.Day),
    }
    tf = tf_map.get(timeframe, TimeFrame(1, TimeFrameUnit.Day))

    # Determine start date based on timeframe and limit
    now = datetime.now(timezone.utc)
    if timeframe in ("1Min", "5Min", "15Min"):
        start = now - timedelta(hours=24)
    elif timeframe == "1Hour":
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=limit * 2)  # buffer for weekends/holidays

    req = StockBarsRequest(
        symbol_or_symbols=symbol.upper(),
        timeframe=tf,
        start=start,
        limit=limit,
        feed="iex"  # use IEX feed (free)
    )
    bars_resp = data_client.get_stock_bars(req)
    bars = bars_resp.data.get(symbol.upper(), [])

    return [
        {
            "time": bar.timestamp.isoformat(),
            "open": float(bar.open),
            "high": float(bar.high),
            "low": float(bar.low),
            "close": float(bar.close),
            "volume": float(bar.volume),
        }
        for bar in bars
    ]


def get_latest_quote(symbol: str) -> dict:
    """Return latest bid/ask quote for a symbol."""
    req = StockLatestQuoteRequest(symbol_or_symbols=symbol.upper(), feed="iex")
    resp = data_client.get_stock_latest_quote(req)
    quote = resp.get(symbol.upper())
    if not quote:
        return {"symbol": symbol, "bid": None, "ask": None, "bid_size": None, "ask_size": None}
    return {
        "symbol": symbol.upper(),
        "bid": float(quote.bid_price) if quote.bid_price else None,
        "ask": float(quote.ask_price) if quote.ask_price else None,
        "bid_size": int(quote.bid_size) if quote.bid_size else None,
        "ask_size": int(quote.ask_size) if quote.ask_size else None,
        "timestamp": quote.timestamp.isoformat() if quote.timestamp else None,
    }


def get_latest_trade(symbol: str) -> dict:
    """Return latest trade price for a symbol."""
    req = StockLatestTradeRequest(symbol_or_symbols=symbol.upper(), feed="iex")
    resp = data_client.get_stock_latest_trade(req)
    trade = resp.get(symbol.upper())
    if not trade:
        return {"symbol": symbol, "price": None, "size": None}
    return {
        "symbol": symbol.upper(),
        "price": float(trade.price),
        "size": int(trade.size),
        "timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
    }


def get_snapshot(symbol: str) -> dict:
    """Full market snapshot: latest bar, daily bar, trade, quote."""
    req = StockSnapshotRequest(symbol_or_symbols=symbol.upper(), feed="iex")
    resp = data_client.get_stock_snapshot(req)
    snap = resp.get(symbol.upper())
    if not snap:
        return {"symbol": symbol}

    lq = snap.latest_quote
    lt = snap.latest_trade
    db = snap.daily_bar
    pb = snap.previous_daily_bar

    return {
        "symbol": symbol.upper(),
        "latest_trade": {
            "price": float(lt.price) if lt else None,
            "size": int(lt.size) if lt else None,
        },
        "latest_quote": {
            "bid": float(lq.bid_price) if lq else None,
            "ask": float(lq.ask_price) if lq else None,
        },
        "daily_bar": {
            "open":   float(db.open) if db else None,
            "high":   float(db.high) if db else None,
            "low":    float(db.low)  if db else None,
            "close":  float(db.close) if db else None,
            "volume": float(db.volume) if db else None,
        },
        "prev_close": float(pb.close) if pb else None,
        "change": (float(db.close) - float(pb.close)) if (db and pb) else None,
        "change_pct": (
            (float(db.close) - float(pb.close)) / float(pb.close) * 100
            if (db and pb and float(pb.close) > 0) else None
        ),
    }


# ── Orders ────────────────────────────────────────────────────────────────────

ORDERS_FETCH_LIMIT = int(os.environ.get("ORDERS_FETCH_LIMIT", "200"))


def get_clock() -> dict:
    """Return Alpaca market clock: is_open, next_open, next_close."""
    clock = trading_client.get_clock()
    return {
        "is_open": clock.is_open,
        "timestamp": clock.timestamp.isoformat() if clock.timestamp else None,
        "next_open": clock.next_open.isoformat() if clock.next_open else None,
        "next_close": clock.next_close.isoformat() if clock.next_close else None,
    }


def get_order_by_id(order_id: str) -> dict:
    """Fetch a single order by ID and return its serialized form."""
    from uuid import UUID
    order = trading_client.get_order_by_id(UUID(order_id))
    return _serialize_order(order)


def get_orders(status: str = "open") -> list:
    """Fetch orders by status: 'open', 'closed', 'all'."""
    from alpaca.trading.requests import GetOrdersRequest
    status_map = {
        "open":   QueryOrderStatus.OPEN,
        "closed": QueryOrderStatus.CLOSED,
        "all":    QueryOrderStatus.ALL,
    }
    req = GetOrdersRequest(status=status_map.get(status, QueryOrderStatus.ALL), limit=ORDERS_FETCH_LIMIT)
    orders = trading_client.get_orders(req)
    return [_serialize_order(o) for o in orders]


def place_order(
    symbol: str,
    qty: float,
    side: str,
    order_type: str,
    limit_price: float | None = None,
    stop_price: float | None = None,
    time_in_force: str = "day"
) -> dict:
    """Place a new order. order_type: market | limit | stop | stop_limit."""
    o_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
    _tif_map = {
        "day": TimeInForce.DAY,
        "gtc": TimeInForce.GTC,
        "ioc": TimeInForce.IOC,
        "fok": TimeInForce.FOK,
        "opg": TimeInForce.OPG,
        "cls": TimeInForce.CLS,
    }
    tif = _tif_map.get(time_in_force.lower(), TimeInForce.DAY)

    if order_type == "market":
        req = MarketOrderRequest(symbol=symbol.upper(), qty=qty, side=o_side, time_in_force=tif)
    elif order_type == "limit":
        req = LimitOrderRequest(symbol=symbol.upper(), qty=qty, side=o_side, time_in_force=tif, limit_price=limit_price)
    elif order_type == "stop":
        req = StopOrderRequest(symbol=symbol.upper(), qty=qty, side=o_side, time_in_force=tif, stop_price=stop_price)
    elif order_type == "stop_limit":
        req = StopLimitOrderRequest(symbol=symbol.upper(), qty=qty, side=o_side, time_in_force=tif, limit_price=limit_price, stop_price=stop_price)
    else:
        raise ValueError(f"Unknown order_type: {order_type}")

    order = trading_client.submit_order(req)
    return _serialize_order(order)


def cancel_order(order_id: str) -> dict:
    """Cancel an order by ID."""
    trading_client.cancel_order_by_id(order_id)
    return {"cancelled": True, "order_id": order_id}


def _serialize_order(order) -> dict:
    """Convert Alpaca order object to JSON-serializable dict."""
    return {
        "id": str(order.id),
        "client_order_id": str(order.client_order_id),
        "symbol": order.symbol,
        "qty": float(order.qty) if order.qty else None,
        "filled_qty": float(order.filled_qty) if order.filled_qty else 0.0,
        "side": str(order.side),
        "type": str(order.type),
        "time_in_force": str(order.time_in_force),
        "status": str(order.status),
        "limit_price": float(order.limit_price) if order.limit_price else None,
        "stop_price": float(order.stop_price) if order.stop_price else None,
        "filled_avg_price": float(order.filled_avg_price) if order.filled_avg_price else None,
        "submitted_at": order.submitted_at.isoformat() if order.submitted_at else None,
        "filled_at": order.filled_at.isoformat() if order.filled_at else None,
    }
