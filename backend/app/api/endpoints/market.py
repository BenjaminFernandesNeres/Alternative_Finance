"""
Market data endpoints – OHLCV bars, quotes, snapshots, simulated order book depth.
All data sourced from Alpaca IEX feed via alpaca_client.
"""
from fastapi import APIRouter, HTTPException, Query
from app.data import alpaca_client as ac

router = APIRouter()


@router.get("/bars/{symbol}")
def get_bars(
    symbol: str,
    timeframe: str = Query("1Day", description="1Min | 5Min | 15Min | 1Hour | 1Day"),
    limit: int = Query(60, ge=1, le=1000)
):
    """OHLCV candlestick bars for a symbol."""
    try:
        bars = ac.get_bars(symbol, timeframe=timeframe, limit=limit)
        return {"symbol": symbol.upper(), "timeframe": timeframe, "bars": bars}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quote/{symbol}")
def get_quote(symbol: str):
    """Latest bid/ask quote."""
    try:
        return ac.get_latest_quote(symbol)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trade/{symbol}")
def get_trade(symbol: str):
    """Latest trade price and size."""
    try:
        return ac.get_latest_trade(symbol)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/snapshot/{symbol}")
def get_snapshot(symbol: str):
    """Full snapshot: latest bar, trade, quote, daily bar, change %."""
    try:
        return ac.get_snapshot(symbol)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orderbook/{symbol}")
def get_orderbook(symbol: str, levels: int = Query(10, ge=1, le=20)):
    """
    Simulated order book depth based on the latest quote.
    Generates synthetic bid/ask levels around the midpoint.
    Alpaca does not provide a Level 2 order book for stocks, so
    we approximate depth from the spread.
    """
    try:
        quote = ac.get_latest_quote(symbol)
        bid   = quote.get("bid")
        ask   = quote.get("ask")

        # After-hours: ask may be 0 or None — fall back to latest trade price
        if not ask:
            trade = ac.get_latest_trade(symbol)
            last  = trade.get("price")
            if not bid and not last:
                raise HTTPException(status_code=404, detail=f"No quote available for {symbol}")
            mid = last or bid
            bid = bid or round(mid * 0.9995, 2)
            ask = round(mid * 1.0005, 2)

        if not bid:
            bid = round(ask * 0.9995, 2)

        spread   = ask - bid
        step     = max(spread / levels, 0.01)
        mid_vol  = 5000

        bids = [
            {
                "price": round(bid - i * step, 4),
                "volume": max(int(mid_vol * (1 + i * 0.5)), 100)
            }
            for i in range(levels)
        ]
        asks = [
            {
                "price": round(ask + i * step, 4),
                "volume": max(int(mid_vol * (1 + i * 0.5)), 100)
            }
            for i in range(levels)
        ]

        return {
            "symbol": symbol.upper(),
            "bid": bid,
            "ask": ask,
            "spread": round(ask - bid, 4),
            "bids": bids,
            "asks": asks,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/multi-quote")
def get_multi_quote(symbols: str = Query(..., description="Comma-separated symbols, e.g. AAPL,SPY,MSFT")):
    """Fetch latest quotes for multiple symbols at once (for the ticker bar)."""
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = []
    for sym in symbol_list:
        try:
            snap = ac.get_snapshot(sym)
            results.append(snap)
        except Exception as e:
            results.append({"symbol": sym, "error": str(e)})
    return results
