"""
Order Manager – wraps alpaca_client for order operations.
Provides ergonomic API for placing, cancelling, and listing orders.
"""
from app.data.alpaca_client import place_order, cancel_order, get_orders


def submit_order(
    symbol: str,
    qty: float,
    side: str,
    order_type: str = "market",
    limit_price: float | None = None,
    stop_price: float | None = None,
    time_in_force: str = "day"
) -> dict:
    """
    Submit a new order via Alpaca.
    side: 'buy' | 'sell'
    order_type: 'market' | 'limit' | 'stop' | 'stop_limit'
    """
    return place_order(
        symbol=symbol,
        qty=qty,
        side=side,
        order_type=order_type,
        limit_price=limit_price,
        stop_price=stop_price,
        time_in_force=time_in_force
    )


def cancel_order_by_id(order_id: str) -> dict:
    """Cancel a specific open order by ID."""
    return cancel_order(order_id)


def list_orders(status: str = "open") -> list:
    """
    List orders.
    status: 'open' | 'closed' | 'all'
    """
    return get_orders(status)
