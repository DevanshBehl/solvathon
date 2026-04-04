import { create } from 'zustand';
import type { AlertPayload } from '@hostel-monitor/types';

interface AlertState {
  alerts: AlertPayload[];
  unreadCount: number;
  addAlert: (alert: AlertPayload) => void;
  markAllRead: () => void;
  resolveAlert: (alertId: string) => void;
  resolveAll: (hostelId?: string) => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  unreadCount: 0,
  addAlert: (alert) =>
    set((state) => {
      const newAlerts = [alert, ...state.alerts].slice(0, 100);
      return { alerts: newAlerts, unreadCount: state.unreadCount + 1 };
    }),
  markAllRead: () => set({ unreadCount: 0 }),
  resolveAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.alertId !== alertId),
    })),
  resolveAll: (hostelId?: string) =>
    set((state) => ({
      alerts: hostelId
        ? state.alerts.filter((a) => a.hostelId !== hostelId)
        : [],
    })),
}));

export const getAlertsForFloor = (hostelId: string, floorNumber: number) => {
  return useAlertStore.getState().alerts.filter(
    (a) => a.hostelId === hostelId && a.floorNumber === floorNumber
  );
};

export const getActiveAlertCameraIds = (hostelId: string, floorNumber: number) => {
  const alerts = getAlertsForFloor(hostelId, floorNumber);
  return new Set(alerts.map((a) => a.cameraId));
};
