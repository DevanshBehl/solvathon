'use client';

import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useSignaling } from '@/hooks/useSignaling';
import { useAlertStore } from '@/stores/alertStore';
import { useCameraStore } from '@/stores/cameraStore';
import type { AlertPayload } from '@hostel-monitor/types';
import { ALERT_TYPE_EMOJI, ALERT_TYPE_LABEL, SEVERITY_COLOR } from '@hostel-monitor/types';

export default function AlertProvider({ children }: { children: React.ReactNode }) {
  const { subscribe, connected } = useSignaling();
  const addAlert = useAlertStore((state) => state.addAlert);
  const setOnline = useCameraStore((state) => state.setOnline);

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

    return () => {
      unsubscribeAlert();
      unsubscribeStatus();
      unsubscribeProducerAdded();
      unsubscribeProducerRemoved();
    };
  }, [connected, subscribe, addAlert, setOnline]);

  return (
    <>
      <Toaster theme="dark" position="top-right" richColors />
      {children}
    </>
  );
}
