"""Alert rules — model fusion logic for multi-model alert classification (PRD §6.2, §7).

Takes raw detections from multiple models and produces structured AlertDecision objects
that bridge.py can forward to HMS as alerts.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import time


@dataclass
class AlertDecision:
    """Final alert to emit to HMS."""
    alert_type: str        # FIGHT, WEAPON, ANIMAL_INTRUSION, ANIMAL_MONKEY, ANIMAL_DOG,
                           # TRESPASSING, FOOD_INTRUSION
    severity: str          # CRITICAL, HIGH, MEDIUM, LOW
    camera_id: str
    description: str
    confidence: float
    classes_detected: List[str]
    models_involved: List[str]
    zone: Optional[str] = None
    timestamp: float = field(default_factory=time.time)


# ── Alert type → severity mapping ─────────────────────────────────────────

ALERT_CONFIG = {
    "FIGHT":             {"severity": "HIGH",     "label": "Fighting Detected"},
    "WEAPON":            {"severity": "CRITICAL", "label": "Weapon Detected"},
    "ANIMAL_INTRUSION":  {"severity": "MEDIUM",   "label": "Animal Intrusion"},
    "ANIMAL_MONKEY":     {"severity": "MEDIUM",   "label": "Monkey Detected"},
    "ANIMAL_DOG":        {"severity": "LOW",      "label": "Dog Detected"},
    "TRESPASSING":       {"severity": "HIGH",     "label": "Unauthorized Person"},
    "FOOD_INTRUSION":    {"severity": "LOW",      "label": "Food Left Open"},
    "CROWD_GATHERING":   {"severity": "MEDIUM",   "label": "Crowd Gathering"},
    "FIRE_DETECTED":     {"severity": "CRITICAL", "label": "Fire/Smoke Detected"},
}


def fuse_detections(
    detections_by_model: Dict[str, List[dict]],
    camera_id: str,
    zone_map: Optional[Dict[str, dict]] = None,
) -> List[AlertDecision]:
    """Fuse detections from multiple models into alert decisions.
    
    Args:
        detections_by_model: {model_name: [{cls, conf, bbox, ...}]}
        camera_id: which camera these detections came from
        zone_map: optional zone configuration for trespassing checks
    
    Returns:
        List of AlertDecision objects (may be empty)
    """
    alerts: List[AlertDecision] = []
    
    # Flatten all detections with their model source
    all_dets = []
    for model_name, dets in detections_by_model.items():
        for d in dets:
            all_dets.append({**d, "_model": model_name})
    
    # ── Rule: WEAPON (model4 = weapons.pt) ────────────────────────────
    weapon_classes = {"knife", "scissors", "baseball bat", "bat", "gun", "pistol", "rifle"}
    weapons_found = [
        d for d in all_dets
        if d.get("cls", "").lower() in weapon_classes and d.get("conf", 0) >= 0.60
    ]
    if weapons_found:
        best = max(weapons_found, key=lambda d: d["conf"])
        alerts.append(AlertDecision(
            alert_type="WEAPON",
            severity="CRITICAL",
            camera_id=camera_id,
            description=f"{best['cls']} detected with {best['conf']:.0%} confidence",
            confidence=best["conf"],
            classes_detected=[d["cls"] for d in weapons_found],
            models_involved=list(set(d["_model"] for d in weapons_found)),
        ))
    
    # ── Rule: FIGHT (model1 fighting + model2 person) ─────────────────
    fight_classes = {"fighting", "fight", "violence", "assault"}
    fights = [
        d for d in all_dets
        if d.get("cls", "").lower() in fight_classes and d.get("conf", 0) >= 0.55
    ]
    persons = [d for d in all_dets if d.get("cls", "").lower() == "person"]
    
    if fights and persons:
        best_fight = max(fights, key=lambda d: d["conf"])
        alerts.append(AlertDecision(
            alert_type="FIGHT",
            severity="HIGH",
            camera_id=camera_id,
            description=f"Fighting detected ({len(persons)} persons) — {best_fight['conf']:.0%} confidence",
            confidence=best_fight["conf"],
            classes_detected=["fighting", "person"],
            models_involved=list(set(d["_model"] for d in fights + persons)),
        ))
    
    # ── Rule: ANIMAL (model3 = monkey_cat_dog_v1.pt) ──────────────────
    animal_map = {
        "monkey": "ANIMAL_MONKEY",
        "cat": "ANIMAL_INTRUSION",
        "dog": "ANIMAL_DOG",
    }
    for animal_cls, alert_type in animal_map.items():
        found = [
            d for d in all_dets
            if d.get("cls", "").lower() == animal_cls and d.get("conf", 0) >= 0.40
        ]
        if found:
            best = max(found, key=lambda d: d["conf"])
            alerts.append(AlertDecision(
                alert_type=alert_type,
                severity=ALERT_CONFIG.get(alert_type, {}).get("severity", "MEDIUM"),
                camera_id=camera_id,
                description=f"{animal_cls.capitalize()} detected — {best['conf']:.0%} confidence",
                confidence=best["conf"],
                classes_detected=[animal_cls],
                models_involved=list(set(d["_model"] for d in found)),
            ))
    
    # ── Rule: TRESPASSING (person in restricted zone) ─────────────────
    if zone_map and persons:
        for person in persons:
            bbox = person.get("bbox") or person.get("xyxy")
            if not bbox:
                continue
            cx = (bbox[0] + bbox[2]) / 2
            cy = (bbox[1] + bbox[3]) / 2
            
            for zone_id, zone in (zone_map or {}).items():
                if zone.get("type") == "restricted":
                    alerts.append(AlertDecision(
                        alert_type="TRESPASSING",
                        severity="HIGH",
                        camera_id=camera_id,
                        description=f"Person in restricted zone: {zone.get('name', zone_id)}",
                        confidence=person.get("conf", 0),
                        classes_detected=["person"],
                        models_involved=[person["_model"]],
                        zone=zone.get("name", zone_id),
                    ))
                    break
    
    # ── Rule: CROWD GATHERING ─────────────────────────────────────────
    crowd = [
        d for d in all_dets
        if d.get("cls", "").lower() in ("crowd_gathering", "crowd")
        and d.get("conf", 0) >= 0.50
    ]
    if crowd:
        best = max(crowd, key=lambda d: d["conf"])
        alerts.append(AlertDecision(
            alert_type="CROWD_GATHERING",
            severity="MEDIUM",
            camera_id=camera_id,
            description=f"Crowd gathering detected — {best['conf']:.0%} confidence",
            confidence=best["conf"],
            classes_detected=["crowd_gathering"],
            models_involved=list(set(d["_model"] for d in crowd)),
        ))
    
    return alerts
