"""
ML Bridge Service — Connects intrusion-suite detection to HMS.

Consumes detection data from the intrusion-suite detection service WebSocket,
and relays alerts/overlays to HMS via its API and WebSocket.

Inference is ON-DEMAND only — waits for START_INFERENCE command from the dashboard.
Camera will NOT open until the user explicitly clicks "Initialize Webcam".

Usage:
    Activate env: source venv/bin/activate
    python bridge.py
"""
import asyncio
import json
import os
import time
import websockets
import httpx
from pathlib import Path

# Configuration
HMS_API_URL = os.getenv("HMS_API_URL", "http://localhost:3000")
HMS_WS_URL = os.getenv("HMS_WS_URL", "ws://localhost:4000")
DETECTION_WS_URL = os.getenv("DETECTION_WS_URL", "ws://localhost:8010/ws/detections")
DETECTION_API_URL = os.getenv("DETECTION_API_URL", "http://localhost:8010")
ML_API_KEY = os.getenv("ML_API_KEY", "ml-service-api-key-change-in-production")
CAMERA_ID = os.getenv("CAMERA_ID", "default")

# Rate limiting: don't flood HMS with alerts
ALERT_COOLDOWN_SEC = 5.0
last_alert_time: dict[str, float] = {}

# Surveillance status per camera
surveillance_active: dict[str, bool] = {}

# Camera list from HMS
all_cameras: list[dict] = []

# ── On-demand inference state ──────────────────────────────────────────────
# The target camera ID that inference is assigned to (set by START_INFERENCE)
inference_target_camera: str | None = None
inference_running: bool = False

# ── Node flag state for auto-reset ─────────────────────────────────────────
# Tracks last alertable detection time per camera for auto-clear
FLAG_RESET_SEC = 10.0  # Reset to green after 10s of no threats
last_threat_time: dict[str, float] = {}
current_flag: dict[str, str] = {}  # cameraId -> 'green' | 'yellow' | 'red'


# Classes from Model 1 that should NOT trigger alerts (non-violent)
# These still show bounding boxes but don't fire toasts/alerts
MODEL1_SUPPRESSED_CLASSES = {
    "normal_walk", "standing", "walking", "sitting", "normal",
    "running", "jogging", "standing_up", "sitting_down",
    "person",  # generic person from model1 is not alertable
}

# Only these models will be enabled
ENABLED_MODEL_NAMES = {"model1.pt", "monkey_cat_dog_v1.pt"}


async def fetch_camera_list():
    """Fetch all camera IDs from HMS API."""
    global all_cameras
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{HMS_API_URL}/api/cameras",
                headers={"x-api-key": ML_API_KEY}
            )
            if resp.status_code == 200:
                data = resp.json()
                all_cameras = data.get("data", [])
                print(f"[bridge] Fetched {len(all_cameras)} cameras from HMS")
                for cam in all_cameras:
                    print(f"  • {cam['label']} ({cam['id'][:8]}...) — Floor {cam['floorNumber']}")
            else:
                print(f"[bridge] Failed to fetch cameras: {resp.status_code}")
    except Exception as e:
        print(f"[bridge] Camera fetch error: {e}")


def get_active_camera_id() -> str:
    """Get the camera ID to tag detections with.

    Uses the inference_target_camera if set (from START_INFERENCE),
    otherwise falls back to the first camera from HMS or CAMERA_ID env var.
    """
    if inference_target_camera:
        return inference_target_camera
    if all_cameras:
        return all_cameras[0]["id"]
    return CAMERA_ID


async def start_inference():
    """Start ML inference with Model 1 (Action) + Animal model only.

    1. Fetches the model list from /detector/models
    2. Calls POST /detector/start with model1.pt + monkey_cat_dog_v1.pt
    """
    global inference_running
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Check if already running
            status_resp = await client.get(f"{DETECTION_API_URL}/detector/status")
            if status_resp.status_code == 200:
                status = status_resp.json()
                if status.get("running"):
                    print(f"[bridge] Inference already running at {status.get('fps', 0):.1f} FPS")
                    inference_running = True
                    return True

            # Fetch available models
            models_resp = await client.get(f"{DETECTION_API_URL}/detector/models")
            if models_resp.status_code != 200:
                print(f"[bridge] Failed to fetch models: {models_resp.status_code}")
                return False

            models = models_resp.json()
            if not models:
                print("[bridge] No models registered in inference service")
                return False

            # Enable ONLY model1.pt (action) and monkey_cat_dog_v1.pt (animal)
            model_configs = []
            for model in models:
                if model["name"] not in ENABLED_MODEL_NAMES:
                    print(f"  ⊘ Skipping {model['name']} (not in enabled set)")
                    continue

                # Enable every class in the selected models
                enabled_classes = {}
                for label in model.get("labels", []):
                    enabled_classes[label] = True

                model_configs.append({
                    "name": model["name"],
                    "enabled": True,
                    "conf": model.get("conf", 0.35),
                    "iou": 0.45,
                    "enabled_classes": enabled_classes,
                })

            if not model_configs:
                print("[bridge] No enabled models found in registry")
                return False

            print(f"[bridge] Starting inference with {len(model_configs)} models:")
            for mc in model_configs:
                print(f"  • {mc['name']} ({len(mc['enabled_classes'])} classes)")

            # Start detection with webcam 0
            start_resp = await client.post(
                f"{DETECTION_API_URL}/detector/start",
                json={
                    "source": {"uri": "0"},
                    "models": model_configs,
                    "zones": [],
                    "zones_version": "1",
                },
                timeout=30.0,
            )

            if start_resp.status_code == 200:
                result = start_resp.json()
                print(f"[bridge] ✓ Started detection: {result}")
                inference_running = True
                return True
            else:
                print(f"[bridge] ✗ Failed to start detection: {start_resp.status_code} {start_resp.text}")
                return False

    except Exception as e:
        print(f"[bridge] Start inference error: {e}")
        return False


async def stop_inference():
    """Stop ML inference and release the camera."""
    global inference_running, inference_target_camera
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{DETECTION_API_URL}/detector/stop")
            if resp.status_code == 200:
                print("[bridge] ✓ Inference stopped, camera released")
            else:
                print(f"[bridge] ✗ Failed to stop inference: {resp.status_code}")
    except Exception as e:
        print(f"[bridge] Stop inference error: {e}")
    finally:
        inference_running = False
        inference_target_camera = None


async def connect_hms_ws():
    """Connect to HMS media server WebSocket."""
    while True:
        try:
            ws = await websockets.connect(HMS_WS_URL, ping_interval=20, ping_timeout=10)
            print(f"[bridge] Connected to HMS WS: {HMS_WS_URL}")
            return ws
        except Exception as e:
            print(f"[bridge] Failed to connect to HMS WS: {e}, retrying in 3s...")
            await asyncio.sleep(3)


async def send_hms_ws(ws, msg_type: str, payload: dict):
    """Send a message to HMS WebSocket."""
    msg = json.dumps({
        "type": msg_type,
        "payload": payload,
        "timestamp": int(time.time() * 1000)
    })
    try:
        await ws.send(msg)
    except Exception as e:
        print(f"[bridge] Failed to send WS message: {e}")


async def post_alert(alert_data: dict):
    """Post alert to HMS API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{HMS_API_URL}/api/alerts/ml",
                json=alert_data,
                headers={"x-api-key": ML_API_KEY}
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"[bridge] Alert posted: {data.get('data', {}).get('alertId', 'unknown')}")
            else:
                print(f"[bridge] Alert post failed: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"[bridge] Alert post error: {e}")


def should_alert(camera_id: str, cls: str) -> bool:
    """Rate-limit alerts per camera+class."""
    key = f"{camera_id}:{cls}"
    now = time.time()
    if key in last_alert_time:
        if now - last_alert_time[key] < ALERT_COOLDOWN_SEC:
            return False
    last_alert_time[key] = now
    return True


def classify_detection(cls: str) -> tuple[str, str]:
    """Map detected class to alert type and risk level."""
    animal_classes = {"dog", "cat", "bird", "horse", "cow", "elephant", "bear", "zebra", "giraffe", "monkey"}
    fight_classes = {"fighting", "fight", "violence", "assault"}
    weapon_classes = {"knife", "scissors", "baseball bat"}
    fire_classes = {"fire", "smoke"}
    food_classes = {"pizza", "bottle", "cup", "bowl", "banana", "apple", "sandwich", "hot dog", "donut", "cake"}

    cls_lower = cls.lower()
    if cls_lower in fight_classes:
        return "FIGHT", "RED"
    elif cls_lower in animal_classes:
        return "ANIMAL_INTRUSION", "YELLOW"
    elif cls_lower in weapon_classes:
        return "WEAPON", "RED"
    elif cls_lower in fire_classes:
        return "FIRE_DETECTED", "RED"
    elif cls_lower in food_classes:
        return "FOOD_INTRUSION", "YELLOW"
    elif cls_lower == "person":
        return "UNAUTHORIZED_PERSON", "YELLOW"
    else:
        return "ANIMAL_INTRUSION", "YELLOW"


def get_flag_for_risk(risk_level: str) -> tuple[str, str]:
    """Map risk level to (flagState, color) for CAMERA_FLAG_UPDATE."""
    if risk_level == "RED":
        return "FIGHT", "red"
    elif risk_level == "YELLOW":
        return "ANIMAL", "yellow"
    return "CLEAR", "green"


async def emit_flag_update(ws, camera_id: str, flag_state: str, color: str, confidence: float = 0):
    """Send CAMERA_FLAG_UPDATE to change node color on the frontend."""
    old_color = current_flag.get(camera_id, "green")
    if old_color == color:
        return  # No change, skip

    current_flag[camera_id] = color
    await send_hms_ws(ws, "CAMERA_FLAG_UPDATE", {
        "cameraId": camera_id,
        "flagState": flag_state,
        "color": color,
        "duration": FLAG_RESET_SEC,
        "confidence": confidence,
        "timestamp": int(time.time() * 1000),
    })
    print(f"[bridge] Flag update: camera {camera_id[:8]}... → {color.upper()} ({flag_state})")


async def flag_reset_loop(hms_ws):
    """Periodically check if cameras should reset to green (no threats for FLAG_RESET_SEC)."""
    while True:
        now = time.time()
        for cam_id, last_time in list(last_threat_time.items()):
            if now - last_time >= FLAG_RESET_SEC and current_flag.get(cam_id) != "green":
                await emit_flag_update(hms_ws, cam_id, "CLEAR", "green")
        await asyncio.sleep(2.0)


async def listen_hms_ws(hms_ws):
    """Listen for messages from HMS (e.g., SURVEILLANCE_TOGGLE, START_INFERENCE)."""
    global inference_target_camera, inference_running
    try:
        async for message in hms_ws:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                payload = data.get("payload", {})

                if msg_type == "SURVEILLANCE_TOGGLE":
                    cam_id = payload.get("cameraId")
                    active = payload.get("active", True)
                    surveillance_active[cam_id] = active
                    print(f"[bridge] Surveillance {'ON' if active else 'OFF'} for camera {cam_id}")

                elif msg_type == "START_INFERENCE":
                    # Dashboard sends this when user clicks "Initialize Webcam"
                    cam_id = payload.get("cameraId")
                    if cam_id:
                        inference_target_camera = cam_id
                        print(f"[bridge] ▶ START_INFERENCE received for camera {cam_id[:8]}...")
                    else:
                        print("[bridge] ▶ START_INFERENCE received (no specific camera)")

                    if not inference_running:
                        started = await start_inference()
                        if started:
                            print("[bridge] ✓ Inference pipeline now active")
                        else:
                            print("[bridge] ✗ Failed to start inference")
                    else:
                        print("[bridge] Inference already running, updated target camera")

                elif msg_type == "STOP_INFERENCE":
                    print("[bridge] ■ STOP_INFERENCE received")
                    await stop_inference()

            except json.JSONDecodeError:
                continue
    except websockets.exceptions.ConnectionClosed:
        print("[bridge] HMS WS connection closed")
    except Exception as e:
        print(f"[bridge] HMS WS listener error: {e}")


async def sync_zones_loop():
    """Periodically fetch zones from HMS and update the detection service."""
    camera_id = get_active_camera_id()
    while True:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                hms_resp = await client.get(f"{HMS_API_URL}/api/cameras/{camera_id}/zones")
                if hms_resp.status_code == 200:
                    zones_data = hms_resp.json().get("data", [])

                    detection_zones = []
                    for z in zones_data:
                        pts = z.get("points", [])
                        if not pts:
                            continue
                        scaled_pts = [[int(p["x"] * 6.4), int(p["y"] * 4.8)] for p in pts]
                        detection_zones.append({
                            "id": z.get("id"),
                            "name": z.get("name", "Zone"),
                            "type": z.get("type", "restricted"),
                            "points": scaled_pts
                        })

                    detect_resp = await client.post(
                        f"{DETECTION_API_URL}/detector/update-zones",
                        json={"zones": detection_zones}
                    )
                    if detect_resp.status_code != 200:
                        print(f"[bridge] Warning: Failed to sync zones to detectsvc: {detect_resp.text}")
        except Exception:
            pass

        await asyncio.sleep(10.0)


async def relay_detections():
    """Main loop: connect to HMS WS, listen for START_INFERENCE, relay detections."""
    global inference_running, inference_target_camera
    hms_ws = await connect_hms_ws()

    # Fetch cameras from HMS
    await fetch_camera_list()
    print(f"[bridge] Loaded {len(all_cameras)} cameras from HMS database")

    # Check if inference is already running (e.g., from a previous session)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            status_resp = await client.get(f"{DETECTION_API_URL}/detector/status")
            if status_resp.status_code == 200:
                status = status_resp.json()
                if status.get("running"):
                    inference_running = True
                    print(f"[bridge] ✓ Inference already running at {status.get('fps', 0):.1f} FPS — will relay detections")
                    # If no target camera set, use the first camera
                    if not inference_target_camera and all_cameras:
                        inference_target_camera = all_cameras[0]["id"]
                        print(f"[bridge]   Auto-targeting camera: {inference_target_camera[:8]}...")
    except Exception as e:
        print(f"[bridge] Could not check inference status: {e}")

    # Start HMS listener (handles START_INFERENCE / STOP_INFERENCE / SURVEILLANCE_TOGGLE)
    asyncio.create_task(listen_hms_ws(hms_ws))
    asyncio.create_task(sync_zones_loop())
    asyncio.create_task(flag_reset_loop(hms_ws))

    # ── NO auto-start! Wait for START_INFERENCE from dashboard ──
    if not inference_running:
        print("[bridge] ⏳ Waiting for START_INFERENCE command from dashboard...")
        print("[bridge]    (Click 'Initialize Webcam' on the dashboard to begin)")
    else:
        print("[bridge] ⏩ Inference already active — relaying detections immediately")

    while True:
        try:
            print(f"[bridge] Connecting to detection service: {DETECTION_WS_URL}")
            async with websockets.connect(DETECTION_WS_URL, ping_interval=20, ping_timeout=10) as detect_ws:
                print("[bridge] Connected to detection service WS")

                async for message in detect_ws:
                    try:
                        # If inference isn't running, skip processing
                        if not inference_running:
                            continue

                        data = json.loads(message)
                        boxes = data.get("boxes", [])
                        frame_w = data.get("width", 640)
                        frame_h = data.get("height", 480)
                        fps = data.get("fps", 0)

                        if not boxes:
                            continue

                        active_cam = get_active_camera_id()

                        if not surveillance_active.get(active_cam, True):
                            continue

                        # Send DETECTION_OVERLAY only to the target camera
                        overlay_payload = {
                            "cameraId": active_cam,
                            "boxes": boxes,
                            "fps": fps,
                            "width": frame_w,
                            "height": frame_h
                        }
                        await send_hms_ws(hms_ws, "DETECTION_OVERLAY", overlay_payload)

                        # ── Process alertable detections ──
                        highest_risk = None  # Track highest risk in this frame

                        for box in boxes:
                            cls = box.get("cls", "unknown")
                            conf = box.get("conf", 0)
                            zone = box.get("zone")
                            event = box.get("event")

                            if conf < 0.45:
                                continue

                            # Suppress non-violent Model 1 classes from alerts
                            # (they still show as bounding boxes in the overlay)
                            if cls.lower() in MODEL1_SUPPRESSED_CLASSES:
                                continue

                            alert_type, risk_level = classify_detection(cls)

                            # Track the highest risk level in this frame for flag update
                            if risk_level == "RED":
                                highest_risk = "RED"
                            elif risk_level == "YELLOW" and highest_risk != "RED":
                                highest_risk = "YELLOW"

                            if event == "intrusion" and zone:
                                risk_level = "RED"
                                highest_risk = "RED"
                                await send_hms_ws(hms_ws, "ZONE_INTRUSION", {
                                    "cameraId": active_cam,
                                    "zone": zone,
                                    "cls": cls,
                                    "confidence": conf,
                                    "riskLevel": risk_level
                                })

                            if should_alert(active_cam, cls):
                                xyxy = box.get("xyxy", [0, 0, 0, 0])
                                alert_data = {
                                    "cameraId": active_cam,
                                    "type": alert_type,
                                    "class": cls,
                                    "confidence": conf,
                                    "boundingBox": {
                                        "x": int(xyxy[0]),
                                        "y": int(xyxy[1]),
                                        "w": int(xyxy[2] - xyxy[0]),
                                        "h": int(xyxy[3] - xyxy[1])
                                    },
                                    "zone": zone,
                                    "riskLevel": risk_level,
                                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                }

                                asyncio.create_task(post_alert(alert_data))
                                await send_hms_ws(hms_ws, "ML_ALERT", alert_data)

                                if risk_level == "RED":
                                    await send_hms_ws(hms_ws, "BUZZER_CONTROL", {
                                        "cameraId": active_cam,
                                        "action": "on",
                                        "tone": "high"
                                    })

                        # ── Emit CAMERA_FLAG_UPDATE based on highest risk ──
                        if highest_risk:
                            flag_state, color = get_flag_for_risk(highest_risk)
                            last_threat_time[active_cam] = time.time()
                            await emit_flag_update(hms_ws, active_cam, flag_state, color)

                    except json.JSONDecodeError:
                        continue
                    except Exception as e:
                        print(f"[bridge] Processing error: {e}")

        except websockets.exceptions.ConnectionClosed:
            print("[bridge] Detection WS closed, reconnecting in 3s...")
            await asyncio.sleep(3)
        except Exception as e:
            print(f"[bridge] Detection WS error: {e}, reconnecting in 3s...")
            await asyncio.sleep(3)

        # Reconnect HMS WS if needed
        try:
            await hms_ws.ping()
        except Exception:
            hms_ws = await connect_hms_ws()
            asyncio.create_task(listen_hms_ws(hms_ws))
            asyncio.create_task(flag_reset_loop(hms_ws))


if __name__ == "__main__":
    print("=" * 50)
    print("  HMS ML Bridge Service")
    print("=" * 50)
    print(f"  Detection WS: {DETECTION_WS_URL}")
    print(f"  HMS API:      {HMS_API_URL}")
    print(f"  HMS WS:       {HMS_WS_URL}")
    print(f"  Camera ID:    {CAMERA_ID}")
    print(f"  Auto-start:   DISABLED (on-demand only)")
    print("=" * 50)
    asyncio.run(relay_detections())
