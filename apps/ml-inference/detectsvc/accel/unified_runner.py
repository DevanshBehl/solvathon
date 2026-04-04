"""Unified inference runner — supports both ONNX (.onnx) and PyTorch/Ultralytics (.pt) models."""
import numpy as np
import cv2
from pathlib import Path
from typing import List, Tuple, Optional
from detectsvc.accel.base import AcceleratorRunner, Detection


class UnifiedRunner(AcceleratorRunner):
    """Inference runner that auto-selects backend based on file extension.
    
    .pt  → ultralytics YOLO (preferred for ml/models/*.pt)
    .onnx → ONNX Runtime (legacy support)
    """
    
    def __init__(self):
        self._backend = None  # 'ultralytics' or 'onnx'
        self._model = None
        self._session = None
        self.input_shape: Optional[Tuple[int, int]] = None
        self.class_names: List[str] = []
    
    def load(self, model_path: Path):
        """Load model — auto-detect backend from extension."""
        model_path = Path(model_path)
        ext = model_path.suffix.lower()
        
        if ext == '.pt':
            self._load_ultralytics(model_path)
        elif ext == '.onnx':
            self._load_onnx(model_path)
        else:
            raise ValueError(f"Unsupported model format: {ext}. Use .pt or .onnx")
    
    # ------------------------------------------------------------------
    # Ultralytics (.pt) backend
    # ------------------------------------------------------------------
    def _load_ultralytics(self, model_path: Path):
        """Load a .pt model via ultralytics YOLO."""
        try:
            from ultralytics import YOLO
        except ImportError:
            raise RuntimeError(
                "ultralytics is required for .pt models. "
                "Install with: pip install ultralytics"
            )
        
        self._backend = 'ultralytics'
        self._model = YOLO(str(model_path), verbose=False)
        
        # Extract class names from the model
        if hasattr(self._model, 'names') and self._model.names:
            self.class_names = list(self._model.names.values())
        
        # Default input shape for YOLO
        self.input_shape = (640, 640)
        print(f"Loaded .pt model: {model_path.name} ({len(self.class_names)} classes) via ultralytics")
    
    # ------------------------------------------------------------------
    # ONNX Runtime (.onnx) backend  — kept for backward compatibility
    # ------------------------------------------------------------------
    def _load_onnx(self, model_path: Path):
        """Load an .onnx model via ONNX Runtime."""
        try:
            import onnxruntime as ort
        except ImportError:
            raise RuntimeError(
                "onnxruntime is required for .onnx models. "
                "Install with: pip install onnxruntime"
            )
        
        self._backend = 'onnx'
        
        sess_options = ort.SessionOptions()
        sess_options.enable_cpu_mem_arena = True
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_options.execution_mode = ort.ExecutionMode.ORT_PARALLEL
        sess_options.inter_op_num_threads = 0
        sess_options.intra_op_num_threads = 0
        sess_options.log_severity_level = 3
        
        providers = [('CPUExecutionProvider', {
            'arena_extend_strategy': 'kSameAsRequested',
        })]
        
        self._session = ort.InferenceSession(
            str(model_path), sess_options=sess_options, providers=providers
        )
        
        self._input_name = self._session.get_inputs()[0].name
        input_shape = self._session.get_inputs()[0].shape
        
        h, w = 640, 640
        if len(input_shape) >= 4:
            h = int(input_shape[2]) if isinstance(input_shape[2], int) and input_shape[2] > 0 else 640
            w = int(input_shape[3]) if isinstance(input_shape[3], int) and input_shape[3] > 0 else 640
        
        self.input_shape = (h, w)
        self._output_names = [o.name for o in self._session.get_outputs()]
        print(f"Loaded .onnx model: {model_path.name} input={self.input_shape} via ONNX Runtime")
    
    # ------------------------------------------------------------------
    # Unified inference
    # ------------------------------------------------------------------
    def infer(self, image: np.ndarray) -> List[Detection]:
        """Run inference using whichever backend is loaded."""
        if self._backend == 'ultralytics':
            return self._infer_ultralytics(image)
        elif self._backend == 'onnx':
            return self._infer_onnx(image)
        else:
            raise RuntimeError("No model loaded")
    
    def _infer_ultralytics(self, image: np.ndarray) -> List[Detection]:
        """Ultralytics YOLO inference."""
        results = self._model(image, verbose=False)
        detections = []
        
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0].cpu().numpy())
                cls_id = int(box.cls[0].cpu().numpy())
                cls_name = self.class_names[cls_id] if cls_id < len(self.class_names) else f"class_{cls_id}"
                
                detections.append(Detection(
                    cls=cls_name,
                    conf=conf,
                    bbox=(float(x1), float(y1), float(x2), float(y2))
                ))
        
        return detections
    
    def _infer_onnx(self, image: np.ndarray) -> List[Detection]:
        """ONNX Runtime inference."""
        h, w = self.input_shape
        resized = cv2.resize(image, (w, h), interpolation=cv2.INTER_NEAREST)
        input_tensor = np.empty((1, 3, h, w), dtype=np.float32)
        input_tensor[0] = resized.transpose(2, 0, 1).astype(np.float32) * (1.0 / 255.0)
        
        outputs = self._session.run(None, {self._input_name: input_tensor})
        return self._postprocess_onnx(outputs[0], image.shape[:2])
    
    def _postprocess_onnx(self, output: np.ndarray, orig_shape: Tuple[int, int]) -> List[Detection]:
        """Postprocess ONNX YOLO output."""
        detections = []
        orig_h, orig_w = orig_shape
        
        if len(output.shape) == 3:
            output = output[0]
        
        model_h, model_w = self.input_shape
        scale_x = orig_w / max(model_w, 1)
        scale_y = orig_h / max(model_h, 1)
        
        if len(output.shape) == 2 and output.shape[1] == 6:
            for det in output:
                x1, y1, x2, y2, conf, cls_idx = det
                cls_idx_int = int(cls_idx)
                cls_name = self.class_names[cls_idx_int] if cls_idx_int < len(self.class_names) else f"class_{cls_idx_int}"
                
                detections.append(Detection(
                    cls=cls_name,
                    conf=float(conf),
                    bbox=(
                        max(0, float(x1) * scale_x),
                        max(0, float(y1) * scale_y),
                        min(orig_w, float(x2) * scale_x),
                        min(orig_h, float(y2) * scale_y),
                    )
                ))
        elif len(output.shape) == 2 and output.shape[1] > 6:
            for det in output:
                x_center, y_center, w_box, h_box, conf = det[:5]
                class_probs = det[5:]
                cls_idx = int(np.argmax(class_probs))
                cls_conf = float(class_probs[cls_idx])
                final_conf = float(conf) * cls_conf
                
                cls_name = self.class_names[cls_idx] if cls_idx < len(self.class_names) else f"class_{cls_idx}"
                
                x1 = (x_center - w_box / 2) * scale_x
                y1 = (y_center - h_box / 2) * scale_y
                x2 = (x_center + w_box / 2) * scale_x
                y2 = (y_center + h_box / 2) * scale_y
                
                detections.append(Detection(
                    cls=cls_name,
                    conf=final_conf,
                    bbox=(max(0, x1), max(0, y1), min(orig_w, x2), min(orig_h, y2))
                ))
        
        return detections
    
    def get_input_shape(self) -> Tuple[int, int]:
        return self.input_shape if self.input_shape else (640, 640)
