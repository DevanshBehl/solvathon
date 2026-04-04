"""Detection service — FastAPI app serving on port 8010.

Exposes the exact same HTTP+WS interface that bridge.py expects:
  POST /detector/start          — start detection with enabled models
  POST /detector/stop           — stop detection
  POST /detector/update-zones   — dynamically update zones
  GET  /detector/status         — get running status and FPS
  GET  /detector/models         — list registered models
  WS   /ws/detections           — live detection box stream
  WS   /ws/alerts               — alert stream
  GET  /                        — service health

bridge.py connects to ws://localhost:8010/ws/detections — zero changes needed.
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import asyncio
import time
import json
import uuid
from pathlib import Path

from detectsvc.config import settings
from detectsvc.registry import registry
from detectsvc.pipeline.capture import VideoCapture
from detectsvc.pipeline.infer import InferencePipeline
from detectsvc.pipeline.tracker import SimpleTracker
from detectsvc.pipeline.zones import ZoneChecker


app = FastAPI(title="HMS ML Inference Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
inference_pipeline = InferencePipeline()
tracker = SimpleTracker()
zone_checker = None
capture = None
is_running = False
frame_count = 0
start_time = None

# WebSocket connections
ws_connections: List[WebSocket] = []
alert_connections: List[WebSocket] = []


@app.on_event("startup")
async def startup():
    """Initialize on startup — register models from ml/models/."""
    print(f"Models root: {settings.models_root_path}")
    registry.auto_register_models()
    
    for model in registry.list_models():
        labels = model.get("labels", [])
        enabled_classes = model.get("enabled_classes", {})
        for label in labels:
            if label not in enabled_classes:
                enabled_classes[label] = True
        registry.update_model(model["name"], enabled_classes=enabled_classes)
    
    print(f"Registered {len(registry.list_models())} models. Ready for detection.")


# ── Request models ────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    source: Dict[str, str]
    models: List[Dict]
    zones: List[Dict] = []
    zones_version: str = "1"


class UpdateZonesRequest(BaseModel):
    zones: List[Dict] = []


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.post("/detector/start")
async def start_detection(request: StartRequest):
    """Start detection stream."""
    global capture, is_running, zone_checker, frame_count, start_time, tracker
    
    try:
        if is_running:
            raise HTTPException(status_code=400, detail="Detection already running")
        
        # Update model configs from request
        for mc in request.models:
            registry.update_model(
                mc["name"],
                enabled=mc.get("enabled", False),
                conf=mc.get("conf", 0.35),
                iou=mc.get("iou", 0.45),
                enabled_classes=mc.get("enabled_classes", {}),
            )
        
        enabled_models = registry.get_enabled_models()
        if not enabled_models:
            raise HTTPException(status_code=400, detail="No models enabled")
        
        print(f"Enabled models: {[m['name'] for m in enabled_models]}")
        
        # Clean slate — unload and reload
        inference_pipeline.unload_all()
        for model in enabled_models:
            model_name = model["name"]
            if not Path(model["path"]).exists():
                raise HTTPException(status_code=404, detail=f"Model not found: {model['path']}")
            print(f"Loading model: {model_name}")
            inference_pipeline.load_model(model_name, model["path"])
        
        tracker = SimpleTracker()
        
        source_uri = request.source.get("uri", "0")
        try:
            capture = VideoCapture(source_uri)
            capture.open()
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e))
        
        zone_checker = ZoneChecker(request.zones)
        is_running = True
        frame_count = 0
        start_time = time.time()
        
        asyncio.create_task(detection_loop())
        return {"status": "started", "models": [m["name"] for m in enabled_models]}
    
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detector/stop")
async def stop_detection():
    global capture, is_running
    is_running = False
    if capture:
        capture.release()
        capture = None
    return {"status": "stopped"}


@app.post("/detector/update-zones")
async def update_zones(request: UpdateZonesRequest):
    global zone_checker
    zone_checker = ZoneChecker(request.zones)
    return {"status": "success", "zones": len(request.zones)}


@app.get("/detector/status")
async def get_status():
    global frame_count, start_time
    fps = 0.0
    if start_time and frame_count > 0:
        elapsed = time.time() - start_time
        fps = frame_count / elapsed if elapsed > 0 else 0.0
    return {
        "running": is_running,
        "fps": round(fps, 1),
        "models": [m["name"] for m in registry.get_enabled_models()],
    }


@app.get("/detector/models")
async def list_detector_models():
    return [
        {
            "name": m["name"],
            "type": m["type"],
            "enabled": m["enabled"],
            "conf": m["conf"],
            "labels": m["labels"],
            "enabled_classes": m["enabled_classes"],
        }
        for m in registry.list_models()
    ]


@app.get("/")
async def root():
    return {"service": "hms-ml-inference", "version": "2.0.0", "status": "ok"}


# ── Detection Loop ────────────────────────────────────────────────────────

async def detection_loop():
    """Main detection loop."""
    global frame_count, capture, is_running
    
    loop_count = 0
    perf_start = time.time()
    cached_enabled_models = []
    cache_counter = 0
    
    while is_running and capture:
        if cache_counter % 100 == 0:
            cached_enabled_models = registry.get_enabled_models()
            if not cached_enabled_models:
                await asyncio.sleep(0.01)
                cache_counter += 1
                continue
        cache_counter += 1
        
        try:
            frame = capture.read()
            if frame is None:
                continue
            
            frame_count += 1
            loop_count += 1
            
            if settings.frame_skip > 1 and frame_count % settings.frame_skip != 0:
                continue
            
            if settings.raw_inference_mode:
                detections = inference_pipeline.infer_frame_fast(frame, cached_enabled_models)
                
                if ws_connections:
                    frame_h, frame_w = frame.shape[:2]
                    frame_data = {
                        "ts": time.time(),
                        "frame_idx": frame_count,
                        "boxes": [
                            {
                                "id": getattr(det, 'track_id', 0) or 0,
                                "cls": det.cls,
                                "conf": det.conf,
                                "xyxy": list(det.bbox),
                                "model": det.model_name,
                            }
                            for det in detections
                        ],
                        "fps": 0.0,
                        "width": frame_w,
                        "height": frame_h,
                    }
                    asyncio.create_task(broadcast_detections(frame_data))
                
                if loop_count % 500 == 0:
                    elapsed = time.time() - perf_start
                    fps = loop_count / elapsed if elapsed > 0 else 0
                    print(f"INFERENCE FPS: {fps:.1f}")
                
                if loop_count % 10 == 0:
                    await asyncio.sleep(0.0001)
            else:
                timestamp = time.time()
                detections = inference_pipeline.infer_frame(frame, cached_enabled_models)
                tracked = tracker.update(detections, timestamp)
                
                frame_h, frame_w = frame.shape[:2]
                frame_data = {
                    "ts": timestamp,
                    "frame_idx": frame_count,
                    "boxes": [],
                    "fps": 0.0,
                    "width": frame_w,
                    "height": frame_h,
                }
                
                for det in tracked:
                    zone_info = zone_checker.check_detection(det) if zone_checker else None
                    frame_data["boxes"].append({
                        "id": getattr(det, 'track_id', 0) or 0,
                        "cls": det.cls,
                        "conf": det.conf,
                        "xyxy": list(det.bbox),
                        "model": det.model_name,
                        "zone": zone_info["zone_name"] if zone_info else None,
                        "event": zone_info["type"] if zone_info else None,
                    })
                
                if start_time:
                    elapsed = timestamp - start_time
                    frame_data["fps"] = frame_count / elapsed if elapsed > 0 else 0.0
                
                asyncio.create_task(broadcast_detections(frame_data))
                await asyncio.sleep(settings.min_sleep_time)
                
        except Exception as e:
            if frame_count % 100 == 0:
                print(f"Detection error: {e}")
            continue


async def broadcast_detections(data: dict):
    """Broadcast to WebSocket connections."""
    disconnected = []
    for ws in ws_connections:
        try:
            await ws.send_json(data)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        ws_connections.remove(ws)


# ── WebSocket endpoints ───────────────────────────────────────────────────

@app.websocket("/ws/detections")
async def websocket_detections(websocket: WebSocket):
    """Detection stream — bridge.py connects here."""
    await websocket.accept()
    ws_connections.append(websocket)
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        ws_connections.remove(websocket)


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await websocket.accept()
    alert_connections.append(websocket)
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        alert_connections.remove(websocket)


# ── Entrypoint ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.detect_host, port=settings.detect_port)
