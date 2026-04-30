#!/bin/bash

PROJECT_ROOT=$(pwd)

echo "====================================="
echo "  Starting GeoAlpha / WarSignals     "
echo "====================================="

# 1. Setup Backend
echo "[1/4] Setting up Python backend..."
cd "$PROJECT_ROOT/backend"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "Installing pip requirements..."
pip install -r requirements.txt

# 2. Setup Frontend
echo "[2/4] Setting up Next.js frontend..."
cd "$PROJECT_ROOT/frontend"
if [ ! -f "package.json" ]; then
    echo "Initializing Next.js... (this might take a minute)"
    # Backup our custom page.tsx temporarily
    mkdir -p /tmp/geoalpha_backup
    cp -r src /tmp/geoalpha_backup/ || true
    rm -rf src
    
    # Init Next.js (non-interactive)
    # npx create-next-app@latest . avoids creating a subfolder
    npx -y create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
    
    # Install additional mocked dependencies used in our dash
    npm install recharts lucide-react
    
    # Restore custom page.tsx
    if [ -f "/tmp/geoalpha_backup/src/app/page.tsx" ]; then
        cp /tmp/geoalpha_backup/src/app/page.tsx src/app/page.tsx
    fi
else
    echo "Installing npm dependencies..."
    npm install
fi

# 3. Kill any existing processes on our ports
echo "[3/4] Freeing ports 8000 and 3000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

# Start Services
echo "[3/4] Starting services..."

# Start Backend
cd "$PROJECT_ROOT/backend"
source venv/bin/activate
export PYTHONPATH="$PROJECT_ROOT/backend"
echo "Starting FastAPI on port 8000..."
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start Frontend
cd "$PROJECT_ROOT/frontend"
echo "Starting Next.js on port 3000..."
npm run dev &
FRONTEND_PID=$!

# Set trap immediately so Ctrl+C cleanly kills both services
trap "echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

echo "====================================="
echo "[4/4] GeoAlpha is running!"
echo "-> Frontend Dashboard: http://localhost:3000"
echo "-> Backend API Docs:   http://localhost:8000/docs"
echo "====================================="
echo "Opening frontend in the default browser..."
sleep 3
open http://localhost:3000

echo "Press Ctrl+C to stop both servers."

# Keep script running while servers are up
wait
