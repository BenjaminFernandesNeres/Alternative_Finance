import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import signals, market, trading, portfolio, autotrade, news, geoint
from app.data.websocket_manager import ws_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start Alpaca WebSocket stream in the background
    stream_task = asyncio.create_task(ws_manager.start_stream())
    # Start AutoTrade price scanner
    autotrade_task = autotrade.start_autotrade_scanner()
    yield
    # Clean up
    stream_task.cancel()
    autotrade_task.cancel()
    
app = FastAPI(
    title="WarSignals Trading Terminal API",
    description="Backend API powered by Alpaca Market Data",
    version="0.2.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market.router, prefix="/api/v1/market", tags=["Market"])
app.include_router(trading.router, prefix="/api/v1/trading", tags=["Trading"])
app.include_router(portfolio.router, prefix="/api/v1/portfolio", tags=["Portfolio"])
app.include_router(signals.router, prefix="/api/v1/signals", tags=["Signals"])
app.include_router(autotrade.router, prefix="/api/v1/autotrade", tags=["AutoTrade"])
app.include_router(news.router, prefix="/api/v1/news", tags=["News"])
app.include_router(geoint.router, prefix="/api/v1/geoint", tags=["GeoINT"])

@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for frontend clients to receive live market data stream.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for client messages if needed
            data = await websocket.receive_text()
            # For now, we just consume and ignore incoming messages
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Trading Terminal API is running."}
