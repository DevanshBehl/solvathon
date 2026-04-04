"""Inference pipeline with class filtering — uses UnifiedRunner for .pt and .onnx."""
import numpy as np
from pathlib import Path
from typing import List, Dict
from detectsvc.accel.unified_runner import UnifiedRunner
from detectsvc.accel.base import Detection
from detectsvc.registry import registry


class InferencePipeline:
    """Inference pipeline with class filtering."""
    
    def __init__(self):
        self.runners: Dict[str, UnifiedRunner] = {}
        self._debug_counter = 0
    
    def load_model(self, model_name: str, model_path: str):
        """Load a model via UnifiedRunner (auto-detects .pt vs .onnx)."""
        runner = UnifiedRunner()
        runner.load(Path(model_path))
        
        # Set class names from registry if available
        model = registry.get_model(model_name)
        if model and model["labels"]:
            runner.class_names = model["labels"]
        
        self.runners[model_name] = runner
    
    def unload_model(self, model_name: str):
        if model_name in self.runners:
            del self.runners[model_name]
    
    def unload_all(self):
        self.runners.clear()
    
    def infer_frame_fast(
        self,
        frame: np.ndarray,
        enabled_models: List[Dict]
    ) -> List[Detection]:
        """Run raw inference with minimal overhead."""
        all_detections = []
        
        for model_config in enabled_models:
            model_name = model_config["name"]
            if model_name not in self.runners:
                continue
            
            runner = self.runners[model_name]
            detections = runner.infer(frame)
            
            conf_threshold = model_config.get("conf", 0.25)
            enabled_classes = model_config.get("enabled_classes", {})
            
            for det in detections:
                if det.conf < conf_threshold:
                    continue
                if enabled_classes and not enabled_classes.get(det.cls, False):
                    continue
                det.model_name = model_name
                all_detections.append(det)
        
        return all_detections
    
    def infer_frame(
        self,
        frame: np.ndarray,
        enabled_models: List[Dict]
    ) -> List[Detection]:
        """Run inference with full class filtering and debug logging."""
        all_detections = []
        
        for model_config in enabled_models:
            model_name = model_config["name"]
            if model_name not in self.runners:
                continue
            
            runner = self.runners[model_name]
            conf_threshold = model_config.get("conf", 0.35)
            enabled_classes = model_config.get("enabled_classes", {})
            
            try:
                detections = runner.infer(frame)
            except Exception as e:
                print(f"Error running inference for {model_name}: {e}")
                continue
            
            raw_count = len(detections)
            filtered_count = 0
            
            for det in detections:
                if det.conf < conf_threshold:
                    continue
                
                if enabled_classes:
                    if not enabled_classes.get(det.cls, False):
                        continue
                
                det.model_name = model_name
                all_detections.append(det)
                filtered_count += 1
            
            self._debug_counter += 1
            if self._debug_counter % 30 == 0:
                enabled_list = [c for c, e in enabled_classes.items() if e] if enabled_classes else ["all"]
                print(f"[{model_name}] Raw: {raw_count}, Filtered: {filtered_count}, Classes: {enabled_list}")
        
        return all_detections
