"""
P&L Calculator – computes estimated and realized profit/loss figures.
All calculations are pure Python; no external API calls required.
"""


def estimate_pnl(
    entry_price: float,
    target_price: float,
    stop_price: float,
    qty: float,
    side: str = "buy"
) -> dict:
    """
    Estimate potential profit and loss for a hypothetical trade.

    Returns:
        estimated_profit  – dollar gain if target is reached
        estimated_loss    – dollar loss if stop is hit (always positive)
        risk_reward_ratio – profit / loss ratio
        breakeven_price   – price at which P&L == 0 (same as entry for simplicity)
        expected_pnl      – net expected value if RR used symmetrically
    """
    multiplier = 1 if side.lower() == "buy" else -1

    profit = (target_price - entry_price) * multiplier * qty
    loss   = abs((stop_price - entry_price) * multiplier * qty)

    rr_ratio = round(profit / loss, 2) if loss > 0 else 0.0

    return {
        "entry_price": entry_price,
        "target_price": target_price,
        "stop_price": stop_price,
        "qty": qty,
        "side": side,
        "estimated_profit": round(profit, 2),
        "estimated_loss": round(loss, 2),
        "risk_reward_ratio": rr_ratio,
        "breakeven_price": entry_price,
        "expected_pnl": round(profit - loss, 2),
    }


def calculate_position_pnl(position: dict) -> dict:
    """
    Derive P&L metrics from a serialized Alpaca position dict.
    Expects keys: avg_entry_price, current_price, qty, side
    """
    avg_cost = position.get("avg_entry_price", 0.0)
    curr     = position.get("current_price") or avg_cost
    qty      = abs(position.get("qty", 0.0))
    side     = position.get("side", "long")

    multiplier = 1 if side == "long" else -1
    unrealized = (curr - avg_cost) * multiplier * qty
    pct        = (unrealized / (avg_cost * qty) * 100) if avg_cost > 0 and qty > 0 else 0.0

    return {
        "symbol": position.get("symbol"),
        "unrealized_pl": round(unrealized, 2),
        "unrealized_pl_pct": round(pct, 2),
        "cost_basis": round(avg_cost * qty, 2),
        "market_value": round(curr * qty, 2),
    }


def calculate_realized_pnl(closed_orders: list) -> float:
    """
    Estimate realized P&L from a list of filled closed orders.
    Pairs buys with sells on the same symbol (FIFO approximation).
    Returns total realized P&L in dollars.
    """
    total = 0.0
    for order in closed_orders:
        if order.get("status") not in ("filled", "partially_filled"):
            continue
        filled_qty   = order.get("filled_qty", 0) or 0
        filled_price = order.get("filled_avg_price", 0) or 0
        side         = str(order.get("side", "")).lower()

        # For a simplified metric: sell revenues minus buy costs
        if "sell" in side:
            total += filled_qty * filled_price
        else:
            total -= filled_qty * filled_price

    return round(total, 2)
