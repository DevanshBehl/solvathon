"""Camera flag engine — temporal risk state per camera (PRD §5.2).

Three flagging rules:
  ANIMAL: animal class continuously in frame > 60s → YELLOW
  FIGHT:  fighting class ≥ 0.55 confidence       → RED (immediate)
  WEAPON: weapon class ≥ 0.60 confidence          → RED/CRITICAL (immediate)

Hysteresis:
  Animal: clears after 30s absence
  Fight:  clears after 45s absence
  Weapon: RED → YELLOW after 2min, never auto-GREEN (manual resolve)
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Callable
import time

from detectsvc.accel.base import Detection
from detectsvc.config import settings


class FlagState(str, Enum):
    CLEAR = "CLEAR"
    ANIMAL = "ANIMAL"
    FIGHT = "FIGHT"
    WEAPON = "WEAPON"


class FlagColor(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


# ── Flag priority (higher = more critical) ────────────────────────────────
FLAG_PRIORITY = {
    FlagState.CLEAR: 0,
    FlagState.ANIMAL: 1,
    FlagState.FIGHT: 2,
    FlagState.WEAPON: 3,
}

# ── Classes that trigger each flag ────────────────────────────────────────
ANIMAL_CLASSES = {"monkey", "cat", "dog"}
FIGHT_CLASSES = {"fighting", "fight", "violence", "assault"}
WEAPON_CLASSES = {"knife", "scissors", "baseball bat", "bat", "gun", "pistol", "rifle"}


@dataclass
class FlagEvent:
    """Emitted when a camera's flag state changes."""
    camera_id: str
    flag_state: str  # FlagState value
    color: str       # FlagColor value
    duration: float  # how long the flag has been active (seconds)
    trigger_model: Optional[str] = None
    confidence: float = 0.0
    timestamp: float = field(default_factory=time.time)


@dataclass
class CameraFlagState:
    """Per-camera flag tracking state."""
    current_flag: FlagState = FlagState.CLEAR
    current_color: FlagColor = FlagColor.GREEN
    flag_start_time: float = 0.0
    last_detection_time: float = 0.0
    detection_class: str = ""
    detection_confidence: float = 0.0
    trigger_model: str = ""
    
    # Animal-specific: track continuous presence
    animal_first_seen: float = 0.0
    animal_last_seen: float = 0.0
    animal_threshold_met: bool = False


class FlagEngine:
    """Per-camera temporal flagging engine."""
    
    def __init__(self, on_flag_change: Optional[Callable[[FlagEvent], None]] = None):
        self.cameras: Dict[str, CameraFlagState] = {}
        self.on_flag_change = on_flag_change
    
    def _get_state(self, camera_id: str) -> CameraFlagState:
        if camera_id not in self.cameras:
            self.cameras[camera_id] = CameraFlagState()
        return self.cameras[camera_id]
    
    def process_detections(
        self,
        camera_id: str,
        detections: List[Detection],
        now: Optional[float] = None,
    ) -> Optional[FlagEvent]:
        """Process detection results and update camera flag state.
        
        Returns FlagEvent if the flag state changed, None otherwise.
        """
        now = now or time.time()
        state = self._get_state(camera_id)
        
        # Classify what we see in this frame
        has_animal = False
        has_fight = False
        has_weapon = False
        best_animal = (0.0, "", "")
        best_fight = (0.0, "", "")
        best_weapon = (0.0, "", "")
        
        for det in detections:
            cls_lower = det.cls.lower().strip()
            model_name = getattr(det, 'model_name', '') or ''
            
            if cls_lower in ANIMAL_CLASSES:
                has_animal = True
                if det.conf > best_animal[0]:
                    best_animal = (det.conf, cls_lower, model_name)
            
            if cls_lower in FIGHT_CLASSES and det.conf >= settings.conf_threshold_action:
                has_fight = True
                if det.conf > best_fight[0]:
                    best_fight = (det.conf, cls_lower, model_name)
            
            if cls_lower in WEAPON_CLASSES and det.conf >= settings.conf_threshold_weapon:
                has_weapon = True
                if det.conf > best_weapon[0]:
                    best_weapon = (det.conf, cls_lower, model_name)
        
        old_flag = state.current_flag
        old_color = state.current_color
        
        # ── Rule 1: WEAPON (highest priority) ─────────────────────────
        if has_weapon:
            state.current_flag = FlagState.WEAPON
            state.current_color = FlagColor.RED
            state.last_detection_time = now
            state.detection_class = best_weapon[1]
            state.detection_confidence = best_weapon[0]
            state.trigger_model = best_weapon[2]
            if old_flag != FlagState.WEAPON:
                state.flag_start_time = now
        
        # ── Rule 2: FIGHT ────────────────────────────────────────────
        elif has_fight:
            if FLAG_PRIORITY[FlagState.FIGHT] > FLAG_PRIORITY[state.current_flag]:
                state.current_flag = FlagState.FIGHT
                state.current_color = FlagColor.RED
                state.last_detection_time = now
                state.detection_class = best_fight[1]
                state.detection_confidence = best_fight[0]
                state.trigger_model = best_fight[2]
                if old_flag != FlagState.FIGHT:
                    state.flag_start_time = now
        
        # ── Rule 3: ANIMAL (sustained presence) ────────────────────────
        elif has_animal:
            state.animal_last_seen = now
            if state.animal_first_seen == 0:
                state.animal_first_seen = now
            
            duration = now - state.animal_first_seen
            if duration >= settings.flag_animal_duration_sec:
                state.animal_threshold_met = True
                if FLAG_PRIORITY[FlagState.ANIMAL] > FLAG_PRIORITY.get(state.current_flag, 0):
                    state.current_flag = FlagState.ANIMAL
                    state.current_color = FlagColor.YELLOW
                    state.last_detection_time = now
                    state.detection_class = best_animal[1]
                    state.detection_confidence = best_animal[0]
                    state.trigger_model = best_animal[2]
                    if old_flag != FlagState.ANIMAL:
                        state.flag_start_time = now
        
        # ── Hysteresis: check if existing flags should expire ──────────
        if not has_weapon and state.current_flag == FlagState.WEAPON:
            elapsed_since = now - state.last_detection_time
            # Weapon: RED → YELLOW at 120s, stays YELLOW indefinitely
            if elapsed_since > 120:
                state.current_color = FlagColor.YELLOW
        
        if not has_fight and state.current_flag == FlagState.FIGHT:
            elapsed_since = now - state.last_detection_time
            if elapsed_since > 45:
                state.current_flag = FlagState.CLEAR
                state.current_color = FlagColor.GREEN
                state.flag_start_time = 0
        
        if not has_animal:
            if state.animal_first_seen > 0:
                if now - state.animal_last_seen > settings.flag_resolve_hysteresis_sec:
                    state.animal_first_seen = 0
                    state.animal_last_seen = 0
                    state.animal_threshold_met = False
                    if state.current_flag == FlagState.ANIMAL:
                        state.current_flag = FlagState.CLEAR
                        state.current_color = FlagColor.GREEN
                        state.flag_start_time = 0
        
        # ── Emit event if state changed ──────────────────────────────
        if state.current_flag != old_flag or state.current_color != old_color:
            event = FlagEvent(
                camera_id=camera_id,
                flag_state=state.current_flag.value,
                color=state.current_color.value,
                duration=now - state.flag_start_time if state.flag_start_time > 0 else 0,
                trigger_model=state.trigger_model,
                confidence=state.detection_confidence,
                timestamp=now,
            )
            if self.on_flag_change:
                self.on_flag_change(event)
            return event
        
        return None
    
    def clear_flag(self, camera_id: str) -> Optional[FlagEvent]:
        """Manually clear a camera's flag (used for resolving weapon alerts)."""
        state = self._get_state(camera_id)
        if state.current_flag == FlagState.CLEAR:
            return None
        
        state.current_flag = FlagState.CLEAR
        state.current_color = FlagColor.GREEN
        state.flag_start_time = 0
        state.animal_first_seen = 0
        state.animal_last_seen = 0
        state.animal_threshold_met = False
        
        event = FlagEvent(
            camera_id=camera_id,
            flag_state=FlagState.CLEAR.value,
            color=FlagColor.GREEN.value,
            duration=0,
            timestamp=time.time(),
        )
        if self.on_flag_change:
            self.on_flag_change(event)
        return event
    
    def get_flag(self, camera_id: str) -> Dict:
        """Get current flag state for a camera."""
        state = self._get_state(camera_id)
        return {
            "camera_id": camera_id,
            "flag_state": state.current_flag.value,
            "color": state.current_color.value,
            "duration": time.time() - state.flag_start_time if state.flag_start_time > 0 else 0,
            "detection_class": state.detection_class,
            "confidence": state.detection_confidence,
        }
