#!/bin/zsh

echo ""
echo -e "\033[36m╔═══════════════════════════════════════════╗\033[0m"
echo -e "\033[36m║          HMS.SYS v3.0 — Startup           ║\033[0m"
echo -e "\033[36m╚═══════════════════════════════════════════╝\033[0m"
echo ""

echo -e "\033[33m[1/5] Clearing ports 3000, 4000, 8010...\033[0m"
lsof -ti:3000,4000,8010 | xargs kill -9 2>/dev/null
sleep 1

echo -e "\033[33m[2/5] Clearing .next cache...\033[0m"
rm -rf apps/web/.next

echo -e "\033[32m[3/5] Starting Dashboard + Media Server...\033[0m"
npm run dev &
NODE_PID=$!

echo -e "\033[32m[4/5] Starting ML Inference Service...\033[0m"
if [ -d "apps/ml-inference" ]; then
    cd apps/ml-inference
    source ../../venv/bin/activate 2>/dev/null || true
    python3 run.py &
    ML_PID=$!
    cd ../..
else
    echo -e "\033[33m  ⚠ apps/ml-inference not found — skipping ML service\033[0m"
fi

echo -e "\033[32m[5/5] Starting ML Bridge (5s delay)...\033[0m"
if [ -f "apps/ml-bridge/bridge.py" ]; then
    (sleep 5 && cd apps/ml-bridge && source ../../venv/bin/activate 2>/dev/null || true && python3 bridge.py) &
    BRIDGE_PID=$!
else
    echo -e "\033[33m  ⚠ apps/ml-bridge/bridge.py not found — skipping bridge\033[0m"
fi

echo ""
echo -e "\033[1;30m┌──────────────────────────────────────────────────┐\033[0m"
echo -e "\033[1;30m│  Service             │  URL                      │\033[0m"
echo -e "\033[1;30m│──────────────────────│───────────────────────────│\033[0m"
echo -e "\033[97m│  Dashboard           │  http://localhost:3000    │\033[0m"
echo -e "\033[97m│  Media Server        │  ws://localhost:4000      │\033[0m"
echo -e "\033[97m│  ML Inference        │  http://localhost:8010    │\033[0m"
echo -e "\033[97m│  ML Bridge           │  (internal relay)         │\033[0m"
echo -e "\033[1;30m│──────────────────────│───────────────────────────│\033[0m"
echo -e "\033[35m│  Login               │  admin@hostel.com         │\033[0m"
echo -e "\033[35m│  Password            │  password123              │\033[0m"
echo -e "\033[1;30m└──────────────────────────────────────────────────┘\033[0m"
echo ""
echo -e "\033[33mPress Ctrl+C to stop all services.\033[0m"
echo ""

cleanup() {
    echo -e "\n\033[31mShutting down...\033[0m"
    kill -9 $NODE_PID 2>/dev/null
    [[ -n "$ML_PID" ]] && kill -9 $ML_PID 2>/dev/null
    [[ -n "$BRIDGE_PID" ]] && kill -9 $BRIDGE_PID 2>/dev/null
    lsof -ti:3000,4000,8010 | xargs kill -9 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

wait $NODE_PID
