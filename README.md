# WarSignals

> A Geopolitical Trading Dashboard — Turning Alternative Data into Live Market Signals.

**Live demo:** https://alternativefinance.vercel.app
**API:** https://alternative-finance.onrender.com
**API docs (Swagger):** https://alternative-finance.onrender.com/docs

---

## Overview

WarSignals is an end-to-end trading dashboard that ingests **alternative, non-financial data** (geopolitical events, satellite imagery, civil aviation tracks) and turns it into actionable signals on financial markets. The system is anchored in the **Alternative Finance** curriculum (Master 203, Université Paris-Dauphine – PSL), and operationalises the Hayekian view of prices as information aggregators, the Grossman–Stiglitz paradox, and the Kyle microstructure framework.

The full architecture, signal formulas and academic motivation are documented in [`WarSignals_Report.pdf`](./WarSignals_Report.pdf).

## What it does

The dashboard is built around three pillars:

1. **Real-time ingestion** of GDELT 2.0 events, NASA GIBS satellite tiles, OpenSky civil-aviation flight paths, and Alpaca broker-grade market data.
2. **A rule-based signal engine** with eleven calibrated commodity engines (oil, natural gas, LNG, uranium, gold, silver, platinum, copper, aluminium, wheat, corn) that map regional conflict intensities, sanctions and shipping disruptions into directional convictions.
3. **An interactive cockpit**: a 3D globe with live conflict / missile / maritime / aviation overlays, signal cards, news feed, an Alpaca order-entry panel, and a portfolio dashboard with FIFO P&L and a 90-day equity curve. An automated execution layer (`AutoTrade`) translates signals into real broker orders via a finite-state machine.

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│  GDELT 2.0  /  NASA GIBS │         │       Next.js 16 frontend    │
│  OpenSky    /  Alpaca    │  ──→    │  (Vercel)                    │
└────────────┬─────────────┘         │  3D globe, signals, trading  │
             │                        └──────────────┬───────────────┘
             ▼                                       │
┌──────────────────────────┐                         │
│   FastAPI backend        │  ◀──── REST + WS  ─────┘
│   (Render)               │
│   • Signal engines       │
│   • Conflict features    │
│   • AutoTrade FSM        │
│   • Alpaca trading       │
└──────────────────────────┘
```

- **Backend:** Python 3.10 · FastAPI · `alpaca-py` · `httpx` · `pandas` / `numpy` — deployed on Render.
- **Frontend:** Next.js 16 · TypeScript · Tailwind CSS · `react-globe.gl` (three.js) — deployed on Vercel.
- **Data feeds:** GDELT 2.0 (15-minute event exports), NASA GIBS WMTS, OpenSky REST, Alpaca REST + WebSocket.

## Repository layout

```
.
├── backend/                 # FastAPI app
│   ├── app/
│   │   ├── api/endpoints/   # signals, market, trading, portfolio, autotrade, news, geoint
│   │   ├── services/
│   │   │   ├── signals/     # 6 rule-based engines (oil, gas, lng, uranium, metals, agri)
│   │   │   ├── features/    # regional conflict aggregator
│   │   │   └── providers/   # gdelt.py and pluggable data providers
│   │   ├── data/            # alpaca_client.py + websocket_manager.py
│   │   └── trading/         # order_manager, portfolio_manager, pnl_calculator
│   └── requirements.txt
├── frontend/                # Next.js 16 app
│   └── src/
│       ├── app/             # routing
│       ├── components/      # GlobeMap, SignalPanel, TradingPanel, PortfolioDashboard, ...
│       └── lib/api.ts       # central API/WS URL helpers
├── start.sh                 # one-command local launcher (backend + frontend)
└── WarSignals_Report.pdf    # full academic report
```

## Run locally

Requirements: Python 3.10+, Node 18+, an Alpaca paper-trading API key.

```bash
git clone https://github.com/BenjaminFernandesNeres/alternativefinance.git
cd alternativefinance

# Set Alpaca credentials
cat > .env <<EOF
ALPACA_API_KEY=your_key_here
ALPACA_SECRET_KEY=your_secret_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets
EOF

# Launches backend (FastAPI on :8000) + frontend (Next.js on :3000)
./start.sh
```

The dashboard opens automatically on http://localhost:3000.

## Deployment notes

The live demo runs on the **free tier** of Render and Vercel. A few practical consequences:

- **Cold start:** Render sleeps after ~15 minutes of inactivity. The first request after a sleep takes ~30 s while the service wakes up.
- **External APIs from cloud IPs:** OpenSky throttles or blocks requests originating from Render's IP pool, so the live aviation layer can be empty in the hosted demo even though it works perfectly when run locally.
- **Paper trading:** the Alpaca client points at `paper-api.alpaca.markets` by default. No real money is ever at risk in this demo.

## Academic context

Master 203 — Alternative Finance · Université Paris-Dauphine – PSL · Academic Year 2025–2026
Supervisor: Prof. Marius Cristian Frunza.

**Authors:** Lenny Zerbib · Maxence Tarlet · Fernandes Neres Benjamin.
