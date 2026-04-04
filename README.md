# 🏢 HMS.SYS — Hostel Monitoring System v3.0

A real-time, AI-powered hostel surveillance platform combining multi-model YOLO inference, WebRTC live streaming, and a brutalist dashboard for end-to-end campus security monitoring.

HMS.SYS runs four ML models in parallel — action/pose detection, pattern recognition, animal intrusion, and weapon detection — then fuses their outputs through a temporal flagging engine that tracks per-camera risk states. When a camera transitions from GREEN (safe) to YELLOW (caution) or RED (danger), the dashboard updates in real time via WebSocket, triggering visual alerts and alarm activation. The entire system is packaged as a Turborepo monorepo with a single-command startup.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     HMS.SYS v3.0                        │
├───────────┬──────────────┬──────────────┬───────────────┤
│  Next.js  │ Media Server │ ML Inference │   ML Bridge   │
│  :3000    │   :4000      │   :8010      │   (relay)     │
│           │  (mediasoup) │  (FastAPI)   │               │
│  Dashboard│  WebRTC SFU  │  YOLO .pt    │  8010 ↔ 4000  │
│  Auth     │  Signaling   │  4 models    │  Flag engine  │
│  REST API │              │              │  Alert rules  │
├───────────┴──────────────┴──────────────┴───────────────┤
│                       MongoDB                           │
│              Hostels · Floors · Cameras · Alerts        │
└─────────────────────────────────────────────────────────┘
```

---

## ML Model Registry

| Model | File | Purpose | Classes |
|-------|------|---------|---------|
| Model 1 | `model1.pt` (53 MB) | Action & Pose Detection | fighting, falling, loitering, crowd |
| Model 2 | `model2.pt` (6 MB) | Pattern Recognition | 80 COCO classes (person, car, bag…) |
| Model 3 | `monkey_cat_dog_v1.pt` (6 MB) | Animal Detection | monkey, cat, dog |
| Model 4 | `weapons.pt` (5.6 MB) | Weapon Detection | knife, scissors, bat, gun |

All models live in `ml/models/` and are loaded via ultralytics YOLO.

---

## Camera Flagging System

| Flag | Trigger | Color | Duration |
|------|---------|-------|----------|
| `CLEAR` | No threats | 🟢 Green | — |
| `ANIMAL` | Animal in frame > 60s | 🟡 Yellow | Clears after 30s absence |
| `FIGHT` | Fighting ≥ 55% confidence | 🔴 Red | Clears after 45s absence |
| `WEAPON` | Weapon ≥ 60% confidence | 🔴 Red | Manual resolve only |

Flag colors are reflected on camera card borders and floor map SVG nodes in real time.

---

## Alert Types

| Type | Severity | Trigger |
|------|----------|---------|
| `WEAPON` | CRITICAL | Model 4 detects knife/gun/bat |
| `FIGHT` | HIGH | Model 1 fighting + Model 2 person confirmation |
| `TRESPASSING` | HIGH | Person in restricted zone |
| `CROWD_GATHERING` | MEDIUM | Model 1 crowd detection |
| `ANIMAL_MONKEY` | MEDIUM | Model 3 monkey detection |
| `ANIMAL_INTRUSION` | MEDIUM | Model 3 sustained animal presence |
| `ANIMAL_DOG` | LOW | Model 3 dog detection |
| `FOOD_INTRUSION` | LOW | Food objects in restricted area |

---

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.9
- **MongoDB** (local or Atlas)
- **npm** ≥ 10

Python packages:
```
pip install -r apps/ml-inference/requirements.txt
```

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd Hostel-Security-System
npm install

# 2. Install ML dependencies
pip install -r apps/ml-inference/requirements.txt

# 3. Set up environment
cp .env.example .env          # edit MongoDB URI, etc.
cp apps/ml-inference/.env.example apps/ml-inference/.env

# 4. Seed database
npm run db:seed

# 5. Start everything
.\start.ps1                   # Windows (PowerShell)
# OR
bash scripts/start.sh         # Linux/macOS
```

After startup, open **http://localhost:3000** and log in with:
- **Email:** `admin@hostel.com`
- **Password:** `password123`

---

## Environment Variables

### Root `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017/hostel-monitor` | MongoDB connection string |
| `NEXTAUTH_SECRET` | — | NextAuth.js session secret |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:4000` | Media server WebSocket URL |

### `apps/ml-inference/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `DETECT_PORT` | `8010` | ML inference service port |
| `MODELS_ROOT` | `../../ml/models` | Path to model weights |
| `CONF_THRESHOLD_ACTION` | `0.55` | Minimum confidence for action models |
| `CONF_THRESHOLD_WEAPON` | `0.60` | Minimum confidence for weapon alerts |
| `FLAG_ANIMAL_DURATION_SEC` | `60` | Seconds before animal flag triggers |
| `INFERENCE_FPS` | `5` | Frames per second to process |

---

## Port Reference

| Port | Service | Protocol |
|------|---------|----------|
| 3000 | Next.js Dashboard | HTTP |
| 4000 | Media Server (mediasoup) | WebSocket |
| 8010 | ML Inference Service | HTTP + WebSocket |
| 27017 | MongoDB | TCP |

---

## Project Structure

```
Hostel-Security-System/
├── apps/
│   ├── web/                  # Next.js 14 dashboard
│   ├── media-server/         # mediasoup SFU + signaling
│   ├── ml-inference/         # FastAPI ML service (port 8010)
│   │   ├── detectsvc/        # Detection engine
│   │   ├── flag_engine.py    # Camera risk flagging
│   │   └── alert_rules.py    # Multi-model alert fusion
│   └── ml-bridge/            # Relay: detection → HMS
├── packages/
│   ├── db/                   # Mongoose models + seed
│   ├── types/                # Shared TypeScript types
│   └── ui/                   # Shared UI components
├── ml/
│   └── models/               # Canonical model weights (.pt)
├── start.ps1                 # Windows startup
├── scripts/start.sh          # Unix startup
└── turbo.json                # Turborepo config
```

---

## Development

```bash
# Run only the web dashboard
npx turbo run dev --filter=@hostel-monitor/web

# Run only the media server
npx turbo run dev --filter=@hostel-monitor/media-server

# Run the ML inference service
cd apps/ml-inference && python run.py

# Run the ML bridge
cd apps/ml-bridge && python bridge.py
```

---

## License

Private — Solevethon 2026
