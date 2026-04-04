#!/usr/bin/env bash
# =====================================================
#  HMS.SYS v3.0 — Full Stack Startup (Unix/macOS)
# =====================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║          HMS.SYS v3.0 — Startup           ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# ── Prereq checks ────────────────────────────────────
check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        echo "ERROR: $1 is not installed."
        exit 1
    fi
}

check_cmd node
check_cmd npm
check_cmd python3 || check_cmd python

PYTHON=$(command -v python3 || command -v python)

# ── Kill stale processes on ports ─────────────────────
echo "[1/6] Clearing ports 3000, 4000, 8010..."
for port in 3000 4000 8010; do
    lsof -ti:$port 2>/dev/null | xargs -r kill -9 2>/dev/null || true
done
sleep 1

# ── Install Node.js dependencies ─────────────────────
if [ ! -d "node_modules" ]; then
    echo "[2/6] Installing Node.js dependencies..."
    npm ci
else
    echo "[2/6] Node.js dependencies OK."
fi

# ── Install Python dependencies ──────────────────────
echo "[3/6] Installing Python dependencies..."
if [ -f "apps/ml-inference/requirements.txt" ]; then
    $PYTHON -m pip install -q -r apps/ml-inference/requirements.txt
fi

# ── Seed database ────────────────────────────────────
echo "[4/6] Seeding database..."
npm run db:seed 2>/dev/null || echo "  ⚠ Seed skipped (may already exist)"

# ── Start all services ────────────────────────────────
echo "[5/6] Starting services..."

# Node.js (dashboard + media server)
npm run dev &
NODE_PID=$!

# ML Inference service
if [ -f "apps/ml-inference/run.py" ]; then
    (cd apps/ml-inference && $PYTHON run.py) &
    ML_PID=$!
fi

# ML Bridge (after delay)
sleep 5
if [ -f "apps/ml-bridge/bridge.py" ]; then
    (cd apps/ml-bridge && $PYTHON bridge.py) &
    BRIDGE_PID=$!
fi

echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  Service             │  URL                      │"
echo "│──────────────────────│───────────────────────────│"
echo "│  Dashboard           │  http://localhost:3000     │"
echo "│  Media Server        │  ws://localhost:4000       │"
echo "│  ML Inference        │  http://localhost:8010     │"
echo "│  ML Bridge           │  (internal relay)         │"
echo "│──────────────────────│───────────────────────────│"
echo "│  Login               │  admin@hostel.com         │"
echo "│  Password            │  password123              │"
echo "└──────────────────────────────────────────────────┘"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# ── Trap cleanup ──────────────────────────────────────
cleanup() {
    echo "Shutting down..."
    kill $NODE_PID 2>/dev/null || true
    kill $ML_PID 2>/dev/null || true
    kill $BRIDGE_PID 2>/dev/null || true
    wait
}
trap cleanup EXIT INT TERM

# Keep alive
wait $NODE_PID
