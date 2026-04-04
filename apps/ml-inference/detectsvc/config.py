"""Detection service configuration."""
from pydantic_settings import BaseSettings
from pathlib import Path


def _resolve_path(path_str: str) -> Path:
    """Resolve path — make absolute if relative, handle both Windows and Linux."""
    path = Path(path_str)
    if not path.is_absolute():
        # Make relative to apps/ml-inference/ (this file is at detectsvc/config.py)
        ml_inference_root = Path(__file__).parent.parent
        path = ml_inference_root / path
    return path.resolve()


class Settings(BaseSettings):
    """Detection service settings."""
    
    # Server
    detect_host: str = "0.0.0.0"
    detect_port: int = 8010
    
    # Models — points to the canonical ml/models/ at repo root
    models_root: str = "../../ml/models"
    
    # Inference
    infer_device: str = "auto"  # auto, onnx_cpu
    target_fps: int = 30
    frame_skip: int = 1
    min_sleep_time: float = 0.001
    
    # Performance
    raw_inference_mode: bool = True
    cache_enabled_models: bool = True
    
    # Storage
    storage_root: str = "storage"
    snap_max_per_event: int = 10
    
    # Confidence thresholds (from PRD §11.1)
    conf_threshold_action: float = 0.55
    conf_threshold_object: float = 0.45
    conf_threshold_weapon: float = 0.60
    
    # Flagging thresholds (from PRD §5.2)
    flag_animal_duration_sec: int = 60
    flag_loitering_duration_sec: int = 120
    flag_resolve_hysteresis_sec: int = 30
    
    # Model toggles
    enable_model1: bool = True
    enable_model2: bool = True
    enable_model3: bool = True
    enable_model4: bool = True
    
    # Inference FPS target
    inference_fps: int = 5
    
    @property
    def models_root_path(self) -> Path:
        """Get models root as Path object."""
        return _resolve_path(self.models_root)
    
    @property
    def storage_root_path(self) -> Path:
        """Get storage root as Path object."""
        return _resolve_path(self.storage_root)
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
