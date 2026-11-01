import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  /** `auto` = high on Wi-Fi, normal on mobile data. */
  streamQuality: 'auto' | 'low' | 'normal' | 'high';
  downloadQuality: 'normal' | 'high';
  /** Save every song you play so it can be replayed offline. */
  autoCache: boolean;
  cacheLimitMB: number;
  /** Only play songs that are saved on the device. */
  offlineMode: boolean;
  /** Keep playing similar songs when the queue runs out. */
  autoplay: boolean;
  /** Allow downloads / auto-cache on mobile data. */
  useCellularForOffline: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  streamQuality: 'auto',
  downloadQuality: 'high',
  autoCache: true,
  cacheLimitMB: 1000,
  offlineMode: false,
  autoplay: true,
  useCellularForOffline: false,
};

const KEY = 'raga:settings:v1';
let current: Settings = DEFAULT_SETTINGS;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadSettings(): Promise<void> {
  if (!loaded) {
    loaded = AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) current = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
      })
      .catch(() => {})
      .finally(() => listeners.forEach((l) => l()));
  }
  return loaded;
}

export const getSettings = () => current;

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const s = useSyncExternalStore(subscribe, getSettings, getSettings);
  return [s, updateSettings];
}
