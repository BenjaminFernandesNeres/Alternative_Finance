"""
Portfolio Manager – aggregates account + position data into
a single portfolio summary for the dashboard.
"""
from app.data.alpaca_client import get_account, get_positions
from app.trading.pnl_calculator import calculate_position_pnl, calculate_realized_pnl
from app.trading.order_manager import list_orders


def get_portfolio_summary() -> dict:
    """
    Return a unified portfolio summary:
    - Account info (equity, cash, buying_power, daily P&L)
    - Position list with real-time P&L
    - Asset allocation breakdown (% per symbol)
    - Total unrealized P&L across all positions
    """
    account   = get_account()
    positions = get_positions()

    # Enrich positions with P&L
    enriched = []
    total_market_value = 0.0
    total_unrealized_pl = 0.0

    for pos in positions:
        pnl_data = calculate_position_pnl(pos)
        enriched.append({**pos, **pnl_data})
        mv = pos.get("market_value") or 0.0
        total_market_value += mv
        total_unrealized_pl += pnl_data.get("unrealized_pl", 0.0)

    # Allocation breakdown
    allocation = []
    for pos in enriched:
        mv = pos.get("market_value") or 0.0
        pct = (mv / total_market_value * 100) if total_market_value > 0 else 0.0
        allocation.append({
            "symbol": pos["symbol"],
            "market_value": round(mv, 2),
            "allocation_pct": round(pct, 2),
        })

    # Realized P&L from closed orders
    closed_orders = list_orders(status="closed")
    realized_pnl = calculate_realized_pnl(closed_orders)

    return {
        "account": account,
        "positions": enriched,
        "allocation": allocation,
        "totals": {
            "portfolio_value": account.get("portfolio_value"),
            "cash": account.get("cash"),
            "total_market_value": round(total_market_value, 2),
            "total_unrealized_pl": round(total_unrealized_pl, 2),
            "realized_pnl": realized_pnl,
            "daily_pnl": account.get("daily_pnl"),
            "daily_pnl_pct": account.get("daily_pnl_pct"),
        }
    }


def get_daily_performance() -> dict:
    """Return today's equity change vs. prior close."""
    account = get_account()
    return {
        "equity": account.get("portfolio_value"),
        "last_equity": account.get("last_equity"),
        "daily_pnl": account.get("daily_pnl"),
        "daily_pnl_pct": account.get("daily_pnl_pct"),
    }
