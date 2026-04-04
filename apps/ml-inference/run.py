"""Thin launcher for the ML inference service."""
import uvicorn
from detectsvc.config import settings

if __name__ == "__main__":
    print(f"Starting HMS ML Inference on {settings.detect_host}:{settings.detect_port}")
    uvicorn.run(
        "detectsvc.main:app",
        host=settings.detect_host,
        port=settings.detect_port,
        reload=False,
    )
