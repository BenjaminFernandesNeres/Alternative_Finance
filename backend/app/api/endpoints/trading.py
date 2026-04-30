"""
Trading endpoints – place, cancel and list orders.
All operations go through Alpaca via order_manager.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from app.trading import order_manager as om

router = APIRouter()


class OrderRequest(BaseModel):
    symbol: str = Field(..., description="Ticker symbol e.g. AAPL")
    qty: float  = Field(..., gt=0, description="Number of shares / contracts")
    side: str   = Field(..., description="buy | sell")
    order_type: str = Field("market", description="market | limit | stop | stop_limit")
    limit_price: Optional[float] = Field(None, description="Required for limit / stop_limit orders")
    stop_price:  Optional[float] = Field(None, description="Required for stop / stop_limit orders")
    time_in_force: str = Field("day", description="day | gtc")


@router.post("/orders")
def place_order(payload: OrderRequest):
    """Submit a new order to Alpaca."""
    try:
        order = om.submit_order(
            symbol       = payload.symbol,
            qty          = payload.qty,
            side         = payload.side,
            order_type   = payload.order_type,
            limit_price  = payload.limit_price,
            stop_price   = payload.stop_price,
            time_in_force= payload.time_in_force,
        )
        return order
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/orders/{order_id}")
def cancel_order(order_id: str):
    """Cancel an open order by ID."""
    try:
        return om.cancel_order_by_id(order_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/orders")
def list_orders(status: str = Query("open", description="open | closed | all")):
    """List orders filtered by status."""
    try:
        return om.list_orders(status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
