#!/bin/bash
set -e

PROJECT_ROOT=$(pwd)

echo "====================================="
echo "  Starting GeoAlpha / WarSignals     "
echo "====================================="

# Detect environment
if [ -z "$PORT" ]; then
    ENV="local"
    PORT=8000
else
    ENV="render"
fi

echo "Environment: $ENV"
echo "Port: $PORT"

# 1. Setup Backend
echo "[1/4] Setting up Python backend..."
cd "$PROJECT_ROOT/backend"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 🚀 RENDER MODE (backend only)
if [ "$ENV" = "render" ]; then
    echo "[Render] Starting FastAPI only..."
    exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
fi

# =========================
# 💻 LOCAL MODE ONLY BELOW
# =========================

# 2. Setup Frontend
echo "[2/4] Setting up Next.js frontend..."
cd "$PROJECT_ROOT/frontend"

if [ ! -f "package.json" ]; then
    echo "Initializing Next.js..."
    
    mkdir -p /tmp/geoalpha_backup
    cp -r src /tmp/geoalpha_backup/ || true
    rm -rf src

    npx -y create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes

    npm install recharts lucide-react

    if [ -f "/tmp/geoalpha_backup/src/app/page.tsx" ]; then
        cp /tmp/geoalpha_backup/src/app/page.tsx src/app/page.tsx
    fi
else
    npm install
fi

# 3. Free ports (LOCAL ONLY)
echo "[3/4] Freeing ports 8000 and 3000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

# Start Services
echo "[3/4] Starting services..."

# Backend
cd "$PROJECT_ROOT/backend"
source venv/bin/activate
export PYTHONPATH="$PROJECT_ROOT/backend"

echo "Starting FastAPI on port $PORT..."
uvicorn app.main:app --host 0.0.0.0 --port $PORT &
BACKEND_PID=$!

# Frontend
cd "$PROJECT_ROOT/frontend"
echo "Starting Next.js on port 3000..."
npm run dev &
FRONTEND_PID=$!

# Trap
trap "echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

echo "====================================="
echo "[4/4] GeoAlpha is running!"
echo "-> Frontend: http://localhost:3000"
echo "-> Backend:  http://localhost:$PORT/docs"
echo "====================================="

sleep 2
open http://localhost:3000 || true

echo "Press Ctrl+C to stop both servers."
wait