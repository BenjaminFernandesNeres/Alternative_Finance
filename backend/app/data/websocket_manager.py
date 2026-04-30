"""
WebSocket manager – streams live Alpaca price data and broadcasts
to all connected frontend WebSocket clients.
Handles reconnection automatically on disconnect.
"""
import asyncio
import json
import logging
import os
from typing import Set

from fastapi import WebSocket
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env'))

logger = logging.getLogger("websocket_manager")

API_KEY    = os.environ.get("ALPACA_API_KEY", "")
SECRET_KEY = os.environ.get("ALPACA_SECRET_KEY", "")


class AlpacaWebSocketManager:
    """
    Manages a pool of frontend WebSocket connections and streams
    live price/quote updates from the Alpaca data stream.
    """

    def __init__(self):
        # Active frontend WebSocket connections
        self.clients: Set[WebSocket] = set()
        # Latest known prices (symbol → price_dict)
        self.latest_prices: dict = {}
        self._stream_task: asyncio.Task | None = None
        # Load initial symbols from env (comma-separated); fallback to a broad default set
        _env_symbols = os.environ.get(
            "ALPACA_STREAM_SYMBOLS",
            "SPY,QQQ,AAPL,GLD,USO,NVDA,META,TSLA,IWM,DIA"
        )
        self._subscribed_symbols: list[str] = [s.strip() for s in _env_symbols.split(",") if s.strip()]

    # ── Connection management ─────────────────────────────────────────────────

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.clients.add(websocket)
        # Send current known prices immediately on connect
        if self.latest_prices:
            try:
                await websocket.send_text(json.dumps({
                    "type": "snapshot",
                    "data": self.latest_prices
                }))
            except Exception:
                pass
        logger.info(f"Client connected. Total: {len(self.clients)}")

    async def disconnect(self, websocket: WebSocket):
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total: {len(self.clients)}")

    # ── Broadcast to all frontends ─────────────────────────────────────────────

    async def broadcast(self, message: dict):
        if not self.clients:
            return
        text = json.dumps(message)
        dead = set()
        for ws in self.clients:
            try:
                await ws.send_text(text)
            except Exception:
                dead.add(ws)
        self.clients -= dead

    # ── Alpaca Stream ─────────────────────────────────────────────────────────

    async def start_stream(self):
        """Start the Alpaca WebSocket data stream (with auto-reconnect)."""
        while True:
            try:
                await self._run_stream()
            except Exception as e:
                logger.warning(f"Alpaca stream error: {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)

    async def _run_stream(self):
        """Connect to Alpaca and stream live quotes/trades."""
        import websockets as ws_lib

        # Alpaca IEX data stream URL (configurable via ALPACA_STREAM_URL)
        url = os.environ.get("ALPACA_STREAM_URL", "wss://stream.data.alpaca.markets/v2/iex")

        async with ws_lib.connect(url) as ws:
            # Auth
            await ws.send(json.dumps({
                "action": "auth",
                "key": API_KEY,
                "secret": SECRET_KEY
            }))
            auth_resp = json.loads(await ws.recv())
            logger.info(f"Alpaca auth response: {auth_resp}")

            # Subscribe to quotes for our symbols (stocks only – crypto needs different feed)
            stock_syms = [s for s in self._subscribed_symbols if "/" not in s]
            await ws.send(json.dumps({
                "action": "subscribe",
                "quotes": stock_syms,
                "trades": stock_syms,
            }))
            sub_resp = json.loads(await ws.recv())
            logger.info(f"Alpaca subscription: {sub_resp}")

            # Consume messages
            async for raw in ws:
                try:
                    messages = json.loads(raw)
                    for msg in (messages if isinstance(messages, list) else [messages]):
                        msg_type = msg.get("T")

                        if msg_type in ("q", "t"):  # quote or trade
                            symbol = msg.get("S", "")
                            price_update = {}

                            if msg_type == "q":
                                price_update = {
                                    "symbol": symbol,
                                    "bid": msg.get("bp"),
                                    "ask": msg.get("ap"),
                                    "bid_size": msg.get("bs"),
                                    "ask_size": msg.get("as"),
                                    "timestamp": msg.get("t"),
                                    "type": "quote"
                                }
                            elif msg_type == "t":
                                price_update = {
                                    "symbol": symbol,
                                    "price": msg.get("p"),
                                    "size": msg.get("s"),
                                    "timestamp": msg.get("t"),
                                    "type": "trade"
                                }

                            # Cache and broadcast
                            self.latest_prices[symbol] = {
                                **self.latest_prices.get(symbol, {}),
                                **price_update
                            }
                            await self.broadcast({
                                "type": "price_update",
                                "data": price_update
                            })
                except Exception as e:
                    logger.debug(f"Parse error: {e}")

    def update_subscriptions(self, symbols: list[str]):
        """Add new symbols to stream (takes effect on next reconnect)."""
        self._subscribed_symbols = list(set(self._subscribed_symbols + symbols))


# Singleton instance shared across the app
ws_manager = AlpacaWebSocketManager()
