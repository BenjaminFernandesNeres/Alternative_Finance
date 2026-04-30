"""
Portfolio endpoints – account info, positions, full portfolio summary.
Data sourced from Alpaca via portfolio_manager.
"""
from fastapi import APIRouter, HTTPException
from app.trading import portfolio_manager as pm
from app.trading.pnl_calculator import estimate_pnl
from pydantic import BaseModel

router = APIRouter()


@router.get("/account")
def get_account():
    """Return Alpaca account info: equity, cash, buying power, daily P&L."""
    try:
        from app.data.alpaca_client import get_account as _get
        return _get()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/positions")
def get_positions():
    """Return all open positions enriched with unrealized P&L."""
    try:
        from app.data.alpaca_client import get_positions as _get
        positions = _get()
        return positions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
def get_summary():
    """Full portfolio summary: account + positions + allocation + totals."""
    try:
        return pm.get_portfolio_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/performance")
def get_performance():
    """Today's equity performance vs. prior close."""
    try:
        return pm.get_daily_performance()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PnLEstimateRequest(BaseModel):
    entry_price: float
    target_price: float
    stop_price: float
    qty: float
    side: str = "buy"


@router.post("/estimate-pnl")
def pnl_estimate(payload: PnLEstimateRequest):
    """
    Calculate estimated profit/loss, risk/reward ratio, and expected P&L
    for a proposed trade. Pure calculation – no order is placed.
    """
    try:
        return estimate_pnl(
            entry_price  = payload.entry_price,
            target_price = payload.target_price,
            stop_price   = payload.stop_price,
            qty          = payload.qty,
            side         = payload.side,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
