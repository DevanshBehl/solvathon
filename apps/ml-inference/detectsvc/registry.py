"""Model registry — registers the 4 canonical .pt models from ml/models/.

Model Registry (PRD §4):
  model1.pt             → Action & Pose Detection (fighting, falling, loitering, crowd)
  model2.pt             → Pattern Recognition & Scene Context (person, bag, objects)
  monkey_cat_dog_v1.pt  → Model 3: Animal Detection (monkey, cat, dog)
  weapons.pt            → Model 4: Weapon Detection (knife, scissors, bat, gun)
"""
from typing import Dict, List, Optional, Set
from pathlib import Path
from detectsvc.config import settings


# ── Class name mappings per model ──────────────────────────────────────────

# Model 1: Action/Pose — class names loaded dynamically from .pt
MODEL1_EXPECTED_CLASSES = ["fighting", "falling", "loitering", "crowd_gathering"]

# Model 2: Pattern/Object — COCO-based + custom
COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
    "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
    "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
    "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
    "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier",
    "toothbrush"
]

# Model 3: Animal Detection
ANIMAL_CLASSES = ["monkey", "cat", "dog"]

# Model 4: Weapon Detection
WEAPON_CLASSES = ["knife", "scissors", "baseball bat", "gun"]


# ── Known model file → type mapping ───────────────────────────────────────

MODEL_FILE_MAP = {
    "model1.pt":             {"type": "action",  "labels": None},      # loaded from .pt
    "model2.pt":             {"type": "coco",    "labels": COCO_CLASSES},
    "monkey_cat_dog_v1.pt":  {"type": "animal",  "labels": ANIMAL_CLASSES},
    "weapons.pt":            {"type": "weapon",  "labels": WEAPON_CLASSES},
}


class ModelRegistry:
    """Model registry with class toggle support."""
    
    def __init__(self):
        self.models: Dict[str, Dict] = {}
        self.models_root = settings.models_root_path
        self.models_root.mkdir(parents=True, exist_ok=True)
    
    def register_model(
        self,
        name: str,
        model_type: str,
        path: Optional[Path] = None,
        labels: Optional[List[str]] = None,
        enabled_classes: Optional[Dict[str, bool]] = None
    ):
        """Register a model."""
        if path is None:
            path = self.models_root / name
        
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")
        
        # If labels not provided but model is .pt, try loading from ultralytics
        if labels is None:
            labels = self._extract_labels(path)
        
        # Initialize enabled_classes — all classes enabled by default
        if enabled_classes is None:
            enabled_classes = {cls: True for cls in labels}
        else:
            for cls in labels:
                if cls not in enabled_classes:
                    enabled_classes[cls] = True
        
        self.models[name] = {
            "name": name,
            "type": model_type,
            "path": str(path),
            "labels": labels,
            "enabled": False,
            "conf": 0.35,
            "iou": 0.45,
            "enabled_classes": enabled_classes,
            "runner": None,
        }
    
    def _extract_labels(self, model_path: Path) -> List[str]:
        """Try to extract class names from a .pt model via ultralytics."""
        if model_path.suffix.lower() == '.pt':
            try:
                from ultralytics import YOLO
                model = YOLO(str(model_path), verbose=False)
                if hasattr(model, 'names') and model.names:
                    return list(model.names.values())
            except Exception as e:
                print(f"Could not extract labels from {model_path.name}: {e}")
        return ["object"]
    
    def get_model(self, name: str) -> Optional[Dict]:
        return self.models.get(name)
    
    def list_models(self) -> List[Dict]:
        return list(self.models.values())
    
    def update_model(
        self,
        name: str,
        enabled: Optional[bool] = None,
        conf: Optional[float] = None,
        iou: Optional[float] = None,
        enabled_classes: Optional[Dict[str, bool]] = None
    ):
        """Update model settings."""
        if name not in self.models:
            raise ValueError(f"Model not found: {name}")
        
        model = self.models[name]
        if enabled is not None:
            model["enabled"] = enabled
        if conf is not None:
            model["conf"] = conf
        if iou is not None:
            model["iou"] = iou
        if enabled_classes is not None:
            model["enabled_classes"].update(enabled_classes)
    
    def get_enabled_models(self) -> List[Dict]:
        return [m for m in self.models.values() if m["enabled"]]
    
    def is_class_enabled(self, model_name: str, class_name: str) -> bool:
        model = self.models.get(model_name)
        if not model or not model["enabled"]:
            return False
        return model["enabled_classes"].get(class_name, True)
    
    def get_all_classes(self) -> Set[str]:
        all_classes = set()
        for model in self.models.values():
            all_classes.update(model["labels"])
        return all_classes
    
    def auto_register_models(self):
        """Auto-register the 4 canonical .pt models from ml/models/."""
        for filename, info in MODEL_FILE_MAP.items():
            path = self.models_root / filename
            if path.exists():
                try:
                    self.register_model(
                        filename,
                        info["type"],
                        path,
                        labels=info["labels"]
                    )
                    print(f"  ✓ Registered {filename} (type={info['type']})")
                except Exception as e:
                    print(f"  ✗ Failed to register {filename}: {e}")
            else:
                print(f"  ⚠ Model not found: {path}")
        
        # Also register any other .pt or .onnx files not in the known map
        for model_file in sorted(self.models_root.glob("*")):
            if model_file.suffix.lower() in ('.pt', '.onnx') and model_file.name not in self.models:
                try:
                    self.register_model(model_file.name, "custom", model_file)
                    print(f"  ✓ Registered {model_file.name} (type=custom)")
                except Exception as e:
                    print(f"  ✗ Failed to register {model_file.name}: {e}")


# Global registry instance
registry = ModelRegistry()
