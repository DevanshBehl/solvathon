"""Video capture module."""
import cv2
from typing import Optional, Union
from pathlib import Path


class VideoCapture:
    """Video capture wrapper."""
    
    def __init__(self, source: Union[str, int, Path]):
        self.source = source
        self.cap = None
    
    def open(self):
        """Open capture with performance optimizations."""
        try:
            if isinstance(self.source, (str, Path)):
                source_str = str(self.source)
                if source_str == "0" or source_str.isdigit():
                    self.cap = cv2.VideoCapture(int(source_str))
                else:
                    self.cap = cv2.VideoCapture(source_str)
            else:
                self.cap = cv2.VideoCapture(self.source)
            
            if not self.cap.isOpened():
                raise RuntimeError(
                    f"Failed to open video source: {self.source}. "
                    "Camera may not be available or already in use."
                )
            
            try:
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                if isinstance(self.source, int) or (
                    isinstance(self.source, str) and str(self.source).isdigit()
                ):
                    self.cap.set(cv2.CAP_PROP_FPS, 30)
                    self.cap.set(
                        cv2.CAP_PROP_FOURCC,
                        cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'),
                    )
            except Exception:
                pass
                
        except Exception as e:
            if isinstance(e, RuntimeError):
                raise
            raise RuntimeError(f"Error initializing video capture: {str(e)}")
    
    def read(self) -> Optional[any]:
        """Read frame."""
        if self.cap is None:
            return None
        ret, frame = self.cap.read()
        return frame if ret and frame is not None else None
    
    def release(self):
        """Release capture."""
        if self.cap:
            self.cap.release()
            self.cap = None
    
    def get_fps(self) -> float:
        if self.cap:
            return self.cap.get(cv2.CAP_PROP_FPS)
        return 30.0
    
    def get_size(self) -> tuple:
        if self.cap:
            w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            return (w, h)
        return (640, 480)
