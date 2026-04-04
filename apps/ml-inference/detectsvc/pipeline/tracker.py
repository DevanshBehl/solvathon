"""Object tracking (simplified ByteTrack)."""
from typing import List, Dict
from detectsvc.accel.base import Detection


class Track:
    """Track object."""
    def __init__(self, track_id: int, detection: Detection, timestamp: float):
        self.track_id = track_id
        self.detection = detection
        self.first_seen = timestamp
        self.last_seen = timestamp
        self.hits = 1
        self.age = 0
    
    def update(self, detection: Detection, timestamp: float):
        self.detection = detection
        self.last_seen = timestamp
        self.hits += 1
        self.age += 1


class SimpleTracker:
    """Simple IoU-based object tracker."""
    
    def __init__(self):
        self.tracks: Dict[int, Track] = {}
        self.next_id = 1
        self.max_age = 30
    
    def update(self, detections: List[Detection], timestamp: float) -> List[Detection]:
        """Update tracks with new detections."""
        updated_detections = []
        
        for det in detections:
            best_track = None
            best_iou = 0.1
            
            for track_id, track in self.tracks.items():
                iou = self._calculate_iou(det.bbox, track.detection.bbox)
                if iou > best_iou and det.cls == track.detection.cls:
                    best_iou = iou
                    best_track = track
            
            if best_track:
                best_track.update(det, timestamp)
                det.track_id = best_track.track_id
            else:
                track_id = self.next_id
                self.next_id += 1
                track = Track(track_id, det, timestamp)
                self.tracks[track_id] = track
                det.track_id = track_id
            
            updated_detections.append(det)
        
        # Remove stale tracks
        to_remove = [
            tid for tid, track in self.tracks.items()
            if track.age > self.max_age * 2
        ]
        for tid in to_remove:
            del self.tracks[tid]
        
        return updated_detections
    
    def _calculate_iou(self, bbox1, bbox2) -> float:
        x1_1, y1_1, x2_1, y2_1 = bbox1
        x1_2, y1_2, x2_2, y2_2 = bbox2
        
        x1_i = max(x1_1, x1_2)
        y1_i = max(y1_1, y1_2)
        x2_i = min(x2_1, x2_2)
        y2_i = min(y2_1, y2_2)
        
        if x2_i < x1_i or y2_i < y1_i:
            return 0.0
        
        intersection = (x2_i - x1_i) * (y2_i - y1_i)
        area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
        area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0.0
