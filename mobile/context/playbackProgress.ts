import { useSyncExternalStore } from 'react';

/**
 * Playback position lives outside React context on purpose: it changes every
 * second, and putting it in the audio context would re-render every screen.
 * Only components that call `usePlaybackProgress()` update on each tick.
 * All values are milliseconds.
 */
export interface PlaybackProgress {
  position: number;
  duration: number;
  buffered: number;
}

let current: PlaybackProgress = { position: 0, duration: 0, buffered: 0 };
const listeners = new Set<() => void>();

export const getPlaybackProgress = () => current;

export function setPlaybackProgress(next: Partial<PlaybackProgress>) {
  const merged = { ...current, ...next };
  if (
    merged.position === current.position &&
    merged.duration === current.duration &&
    merged.buffered === current.buffered
  ) {
    return;
  }
  current = merged;
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function usePlaybackProgress(): PlaybackProgress {
  return useSyncExternalStore(subscribe, getPlaybackProgress, getPlaybackProgress);
}
