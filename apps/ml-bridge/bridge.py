"""
ML Bridge Service — Connects intrusion-suite detection to HMS.

Consumes detection data from the intrusion-suite detection service WebSocket,
and relays alerts/overlays to HMS via its API and WebSocket.

Auto-starts ML inference with Model 1 (Action) + Animal model on startup.

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
    
    Uses the first camera from the HMS database if available,
    otherwise falls back to CAMERA_ID env var.
    """
    if all_cameras:
        return all_cameras[0]["id"]
    return CAMERA_ID


async def auto_start_inference():
    """Auto-start ML inference with ALL models enabled.
    
    1. Fetches the model list from /detector/models
    2. Calls POST /detector/start with all models enabled + webcam source
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Check if already running
            status_resp = await client.get(f"{DETECTION_API_URL}/detector/status")
            if status_resp.status_code == 200:
                status = status_resp.json()
                if status.get("running"):
                    print(f"[bridge] Inference already running at {status.get('fps', 0):.1f} FPS")
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

            # Only enable Model 1 (action) and Animal model
            ENABLED_MODELS = {"model1.pt", "monkey_cat_dog_v1.pt"}
            model_configs = []
            for model in models:
                if model["name"] not in ENABLED_MODELS:
                    print(f"  ⊘ Skipping {model['name']} (not in active set)")
                    continue

                # Enable every class in each selected model
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
                print(f"[bridge] ✓ Auto-started detection: {result}")
                return True
            else:
                print(f"[bridge] ✗ Failed to start detection: {start_resp.status_code} {start_resp.text}")
                return False

    except Exception as e:
        print(f"[bridge] Auto-start error: {e}")
        return False


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


# Non-threatening action classes from Model 1 that should NOT trigger alerts
SUPPRESSED_ACTION_CLASSES = {
    "normal_walk", "walking", "standing", "sitting", "normal",
    "running", "jogging", "bending", "hand_shaking", "hugging",
    "reading", "eating", "drinking", "talking", "texting",
    "using_phone", "waving", "pointing",
}


def classify_detection(cls: str) -> tuple[str, str]:
    """Map detected class to alert type and risk level."""
    animal_classes = {"dog", "cat", "bird", "horse", "cow", "elephant", "bear", "zebra", "giraffe", "monkey"}
    fight_classes = {"fighting", "fight", "violence", "assault", "kicking", "punching", "stabbing"}
    weapon_classes = {"knife", "scissors", "baseball bat"}
    fire_classes = {"fire", "smoke"}

    cls_lower = cls.lower()
    if cls_lower in fight_classes:
        return "FIGHT", "RED"
    elif cls_lower in animal_classes:
        return "ANIMAL_INTRUSION", "YELLOW"
    elif cls_lower in weapon_classes:
        return "WEAPON", "RED"
    elif cls_lower in fire_classes:
        return "FIRE_DETECTED", "RED"
    elif cls_lower in SUPPRESSED_ACTION_CLASSES:
        return "SUPPRESSED", "NONE"  # will be filtered out
    elif cls_lower == "person":
        return "UNAUTHORIZED_PERSON", "YELLOW"
    else:
        return "ANIMAL_INTRUSION", "YELLOW"


async def listen_hms_ws(hms_ws):
    """Listen for messages from HMS (e.g., SURVEILLANCE_TOGGLE)."""
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
    """Main loop: connect to detection service WS and relay to HMS."""
    hms_ws = await connect_hms_ws()

    # Fetch cameras from HMS
    await fetch_camera_list()
    camera_id = get_active_camera_id()
    print(f"[bridge] Active camera ID for detections: {camera_id}")

    # Start HMS listener and zone sync in background
    asyncio.create_task(listen_hms_ws(hms_ws))
    asyncio.create_task(sync_zones_loop())

    # Auto-start inference
    print("[bridge] Attempting to auto-start ML inference...")
    await asyncio.sleep(2)
    started = await auto_start_inference()
    if started:
        print("[bridge] ✓ Inference pipeline is active")
    else:
        print("[bridge] ⚠ Inference not started — will retry when detection WS connects")

    while True:
        try:
            print(f"[bridge] Connecting to detection service: {DETECTION_WS_URL}")
            async with websockets.connect(DETECTION_WS_URL, ping_interval=20, ping_timeout=10) as detect_ws:
                print("[bridge] Connected to detection service")

                if not started:
                    started = await auto_start_inference()

                async for message in detect_ws:
                    try:
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

                        # Broadcast to ALL cameras (each camera gets all models)
                        cameras_to_notify = [active_cam]
                        if all_cameras:
                            cameras_to_notify = [cam["id"] for cam in all_cameras]

                        for cam_id in cameras_to_notify:
                            if not surveillance_active.get(cam_id, True):
                                continue

                            overlay_payload = {
                                "cameraId": cam_id,
                                "boxes": boxes,
                                "fps": fps,
                                "width": frame_w,
                                "height": frame_h
                            }
                            await send_hms_ws(hms_ws, "DETECTION_OVERLAY", overlay_payload)

                        # Check for alertable detections
                        for box in boxes:
                            cls = box.get("cls", "unknown")
                            conf = box.get("conf", 0)
                            zone = box.get("zone")
                            event = box.get("event")

                            if conf < 0.45:
                                continue

                            alert_type, risk_level = classify_detection(cls)

                            # Skip non-threatening action classes (still visible in overlay)
                            if alert_type == "SUPPRESSED":
                                continue

                            if event == "intrusion" and zone:
                                risk_level = "RED"
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


if __name__ == "__main__":
    print("=" * 50)
    print("  HMS ML Bridge Service")
    print("=" * 50)
    print(f"  Detection WS: {DETECTION_WS_URL}")
    print(f"  HMS API:      {HMS_API_URL}")
    print(f"  HMS WS:       {HMS_WS_URL}")
    print(f"  Camera ID:    {CAMERA_ID}")
    print(f"  Auto-start:   ENABLED (model1 + animal only)")
    print("=" * 50)
    asyncio.run(relay_detections())
