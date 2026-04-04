'use client';

import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useSignaling } from '@/hooks/useSignaling';
import { useAlertStore } from '@/stores/alertStore';
import { useCameraStore } from '@/stores/cameraStore';
import { useDetectionStore } from '@/stores/detectionStore';
import type {
  AlertPayload,
  CameraFlagUpdatePayload,
  DetectionOverlayPayload,
  MLAlertPayload,
  ZoneIntrusionPayload,
  BuzzerControlPayload,
} from '@hostel-monitor/types';
import { ALERT_TYPE_EMOJI, ALERT_TYPE_LABEL, SEVERITY_COLOR } from '@hostel-monitor/types';

export default function AlertProvider({ children }: { children: React.ReactNode }) {
  const { subscribe, connected } = useSignaling();
  const addAlert = useAlertStore((state) => state.addAlert);
  const setOnline = useCameraStore((state) => state.setOnline);
  const setFlag = useCameraStore((state) => state.setFlag);
  const setDetectionBoxes = useDetectionStore((state) => state.setDetectionBoxes);
  const setAlarm = useDetectionStore((state) => state.setAlarm);
  const addZoneAlert = useDetectionStore((state) => state.addZoneAlert);

  useEffect(() => {
    if (!connected) return;

    // Handle Alerts
    const unsubscribeAlert = subscribe('ALERT', (payload: AlertPayload) => {
      addAlert(payload);

      const emoji = ALERT_TYPE_EMOJI[payload.alertType];
      const label = ALERT_TYPE_LABEL[payload.alertType];

      toast(`${emoji} ${label}`, {
        description: `${payload.hostelId} - Floor ${payload.floorNumber} | Camera ${payload.cameraLabel}`,
        action: {
          label: 'View',
          onClick: () => {
            window.location.href = `/hostel/${payload.hostelId}/floor/${payload.floorNumber}`;
          }
        },
        duration: 10000,
        style: {
          borderLeft: `5px solid ${SEVERITY_COLOR[payload.severity]}`
        }
      });
    });

    // Handle Camera Status
    const unsubscribeStatus = subscribe('CAMERA_STATUS', (payload: { cameraId: string, isOnline: boolean }) => {
      setOnline(payload.cameraId, payload.isOnline);
    });

    // Implicit status via producer events
    const unsubscribeProducerAdded = subscribe('PRODUCER_ADDED', (payload: { cameraId: string }) => {
      setOnline(payload.cameraId, true);
    });

    const unsubscribeProducerRemoved = subscribe('PRODUCER_REMOVED', (payload: { cameraId: string }) => {
      setOnline(payload.cameraId, false);
    });

    // Handle Camera Flag Updates from ML flag engine
    const unsubscribeFlagUpdate = subscribe('CAMERA_FLAG_UPDATE', (payload: CameraFlagUpdatePayload) => {
      setFlag(payload.cameraId, payload.flagState, payload.color);
      
      // Show toast for RED flags
      if (payload.color === 'red') {
        toast.error(`🚨 ${payload.flagState} detected`, {
          description: `Camera ${payload.cameraId} — ${payload.confidence ? `${(payload.confidence * 100).toFixed(0)}% confidence` : 'threat detected'}`,
          duration: 8000,
        });
      }
    });

    // ── ML Detection Events ─────────────────────────────

    // DETECTION_OVERLAY — live bounding boxes from ML inference
    const unsubscribeDetection = subscribe('DETECTION_OVERLAY', (payload: DetectionOverlayPayload) => {
      if (payload.cameraId && payload.boxes) {
        setDetectionBoxes(payload.cameraId, payload.boxes);
      }
    });

    // ML_ALERT — ML detection alert (fires for significant detections)
    const unsubscribeMLAlert = subscribe('ML_ALERT', (payload: MLAlertPayload) => {
      const riskEmoji = payload.riskLevel === 'RED' ? '🔴' : '🟡';
      toast(`${riskEmoji} ${payload.class} detected`, {
        description: `Camera ${payload.cameraId} — ${(payload.confidence * 100).toFixed(0)}% confidence${payload.zone ? ` in ${payload.zone}` : ''}`,
        duration: 6000,
        style: {
          borderLeft: `5px solid ${payload.riskLevel === 'RED' ? '#ef4444' : '#f59e0b'}`,
        },
      });
    });

    // ZONE_INTRUSION — zone intrusion alerts
    const unsubscribeZoneIntrusion = subscribe('ZONE_INTRUSION', (payload: ZoneIntrusionPayload) => {
      addZoneAlert({
        cameraId: payload.cameraId,
        zone: payload.zone,
        cls: payload.cls,
        confidence: payload.confidence,
        riskLevel: payload.riskLevel,
      });

      toast.error(`⚠ Zone Intrusion: ${payload.zone}`, {
        description: `${payload.cls} detected in restricted zone — Camera ${payload.cameraId}`,
        duration: 8000,
      });
    });

    // BUZZER_CONTROL — alarm toggle from ML
    const unsubscribeBuzzer = subscribe('BUZZER_CONTROL', (payload: BuzzerControlPayload) => {
      if (payload.action === 'on') {
        setAlarm(payload.cameraId, { active: true, tone: payload.tone });
      } else {
        setAlarm(payload.cameraId, { active: false, tone: payload.tone });
      }
    });

    return () => {
      unsubscribeAlert();
      unsubscribeStatus();
      unsubscribeProducerAdded();
      unsubscribeProducerRemoved();
      unsubscribeFlagUpdate();
      unsubscribeDetection();
      unsubscribeMLAlert();
      unsubscribeZoneIntrusion();
      unsubscribeBuzzer();
    };
  }, [connected, subscribe, addAlert, setOnline, setFlag, setDetectionBoxes, setAlarm, addZoneAlert]);

  return (
    <>
      <Toaster theme="dark" position="top-right" richColors />
      {children}
    </>
  );
}
