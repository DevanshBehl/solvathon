import { create } from 'zustand';

type FlagState = 'CLEAR' | 'ANIMAL' | 'FIGHT' | 'WEAPON';
type FlagColor = 'green' | 'yellow' | 'red';

interface CameraState {
  onlineStatus: Map<string, boolean>;
  flagState: Map<string, FlagState>;
  flagColor: Map<string, FlagColor>;

  setOnline: (cameraId: string, isOnline: boolean) => void;
  setFlag: (cameraId: string, flag: FlagState, color: FlagColor) => void;
  clearFlag: (cameraId: string) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  onlineStatus: new Map(),
  flagState: new Map(),
  flagColor: new Map(),

  setOnline: (cameraId, isOnline) =>
    set((state) => {
      const newMap = new Map(state.onlineStatus);
      newMap.set(cameraId, isOnline);
      return { onlineStatus: newMap };
    }),

  setFlag: (cameraId, flag, color) =>
    set((state) => {
      const newFlags = new Map(state.flagState);
      const newColors = new Map(state.flagColor);
      newFlags.set(cameraId, flag);
      newColors.set(cameraId, color);
      return { flagState: newFlags, flagColor: newColors };
    }),

  clearFlag: (cameraId) =>
    set((state) => {
      const newFlags = new Map(state.flagState);
      const newColors = new Map(state.flagColor);
      newFlags.set(cameraId, 'CLEAR');
      newColors.set(cameraId, 'green');
      return { flagState: newFlags, flagColor: newColors };
    }),
}));

export const getIsOnline = (cameraId: string) => {
  return useCameraStore.getState().onlineStatus.get(cameraId) ?? true;
};

export const getFlagColor = (cameraId: string): FlagColor => {
  return useCameraStore.getState().flagColor.get(cameraId) ?? 'green';
};

export const getFlagState = (cameraId: string): FlagState => {
  return useCameraStore.getState().flagState.get(cameraId) ?? 'CLEAR';
};
