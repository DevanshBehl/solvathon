import { create } from 'zustand';

interface CameraState {
  onlineStatus: Map<string, boolean>;
  setOnline: (cameraId: string, isOnline: boolean) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  onlineStatus: new Map(),
  setOnline: (cameraId, isOnline) =>
    set((state) => {
      const newMap = new Map(state.onlineStatus);
      newMap.set(cameraId, isOnline);
      return { onlineStatus: newMap };
    }),
}));

export const getIsOnline = (cameraId: string) => {
  return useCameraStore.getState().onlineStatus.get(cameraId) ?? true;
};
