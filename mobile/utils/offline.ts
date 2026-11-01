import { useSyncExternalStore } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pickStreamUrl, type StreamQuality, type Track } from '../services/musicApi';
import { getNetState } from './network';
import { getSettings } from './settings';

/**
 * Offline audio store.
 *
 *  - `download`: saved on purpose by the user ("Download" button) - never evicted
 *  - `cache`   : saved automatically when a song is played, so anything you
 *                have listened to replays without internet. Oldest-played
 *                entries are evicted once the cache passes the size limit.
 *
 * Files live in the app's document directory (not the OS-purgeable cache dir).
 */

export type OfflineKind = 'download' | 'cache';

interface OfflineEntry {
  track: Track;
  uri: string;
  artUri?: string;
  bytes: number;
  kind: OfflineKind;
  savedAt: number;
  lastPlayedAt: number;
}

const INDEX_KEY = 'raga:offline:v1';
const ROOT = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}raga-audio/` : null;
const MAX_PARALLEL = 2;

let entries: Record<string, OfflineEntry> = {};
let progress: Record<string, number> = {};
let ready: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();
const structListeners = new Set<() => void>();
const inflight = new Map<string, Promise<boolean>>();
const waiting: (() => void)[] = [];
let running = 0;

/** Something structural changed (a file was added or removed). */
function emit() {
  version++;
  snapshot = null;
  structSnapshot = null;
  listeners.forEach((l) => l());
  structListeners.forEach((l) => l());
}

/** Download progress moved; throttled so a download does not re-render the app constantly. */
let lastProgressEmit = 0;
function emitProgress(force = false) {
  const now = Date.now();
  if (!force && now - lastProgressEmit < 300) return;
  lastProgressEmit = now;
  version++;
  snapshot = null;
  listeners.forEach((l) => l());
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    AsyncStorage.setItem(INDEX_KEY, JSON.stringify(entries)).catch(() => {});
  }, 400);
}

const extensionOf = (url: string) => /\.(mp3|mp4|m4a|aac|ogg|opus)(?:\?|$)/i.exec(url)?.[1]?.toLowerCase() ?? 'm4a';
const safeName = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_');

export function initOffline(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    if (!ROOT) return;
    try {
      await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
    } catch {
      // already exists
    }
    try {
      const raw = await AsyncStorage.getItem(INDEX_KEY);
      entries = raw ? (JSON.parse(raw) as Record<string, OfflineEntry>) : {};
    } catch {
      entries = {};
    }
    // Drop index rows whose file vanished (user cleared storage, OS cleanup, ...).
    await Promise.all(
      Object.entries(entries).map(async ([id, e]) => {
        try {
          const info = await FileSystem.getInfoAsync(e.uri);
          if (!info.exists) delete entries[id];
        } catch {
          delete entries[id];
        }
      })
    );
    emit();
    persist();
  })();
  return ready;
}

// ---- queries ---------------------------------------------------------------

export const getLocalUri = (id: string): string | undefined => entries[id]?.uri;
export const isDownloaded = (id: string) => entries[id]?.kind === 'download';
export const isAvailableOffline = (id: string) => !!entries[id];

/** Track as it should appear offline: local audio + local artwork when we have it. */
function toOfflineTrack(e: OfflineEntry): Track {
  return {
    ...e.track,
    localUri: e.uri,
    image: e.artUri ? [{ quality: 'local', url: e.artUri }] : e.track.image,
  };
}

export const getOfflineTrack = (id: string): Track | undefined =>
  entries[id] ? toOfflineTrack(entries[id]) : undefined;

export const getDownloadedTracks = (): Track[] =>
  Object.values(entries)
    .filter((e) => e.kind === 'download')
    .sort((a, b) => b.savedAt - a.savedAt)
    .map(toOfflineTrack);

export const getPlayableOfflineTracks = (): Track[] =>
  Object.values(entries)
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    .map(toOfflineTrack);

export interface OfflineUsage {
  downloadBytes: number;
  cacheBytes: number;
  downloadCount: number;
  cacheCount: number;
}

export function getUsage(): OfflineUsage {
  const u: OfflineUsage = { downloadBytes: 0, cacheBytes: 0, downloadCount: 0, cacheCount: 0 };
  for (const e of Object.values(entries)) {
    if (e.kind === 'download') {
      u.downloadBytes += e.bytes;
      u.downloadCount++;
    } else {
      u.cacheBytes += e.bytes;
      u.cacheCount++;
    }
  }
  return u;
}

// ---- React binding -----------------------------------------------------------

export interface OfflineSnapshot {
  version: number;
  downloadedIds: Set<string>;
  availableIds: Set<string>;
  progress: Record<string, number>;
  downloads: Track[];
  usage: OfflineUsage;
}

let snapshot: OfflineSnapshot | null = null;

function getSnapshot(): OfflineSnapshot {
  if (!snapshot) {
    snapshot = {
      version,
      downloadedIds: new Set(Object.keys(entries).filter((id) => entries[id].kind === 'download')),
      availableIds: new Set(Object.keys(entries)),
      progress: { ...progress },
      downloads: getDownloadedTracks(),
      usage: getUsage(),
    };
  }
  return snapshot;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const useOffline = (): OfflineSnapshot => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** Structure-only view (no progress ticks) for long-lived consumers such as the audio provider. */
export interface OfflineStructure {
  downloadedIds: Set<string>;
  availableIds: Set<string>;
  downloads: Track[];
}

let structSnapshot: OfflineStructure | null = null;

function getStructSnapshot(): OfflineStructure {
  if (!structSnapshot) {
    structSnapshot = {
      downloadedIds: new Set(Object.keys(entries).filter((id) => entries[id].kind === 'download')),
      availableIds: new Set(Object.keys(entries)),
      downloads: getDownloadedTracks(),
    };
  }
  return structSnapshot;
}

const subscribeStruct = (cb: () => void) => {
  structListeners.add(cb);
  return () => {
    structListeners.delete(cb);
  };
};

export const useOfflineStructure = (): OfflineStructure =>
  useSyncExternalStore(subscribeStruct, getStructSnapshot, getStructSnapshot);

// ---- writes -------------------------------------------------------------------

function withSlot<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      running++;
      job()
        .then(resolve, reject)
        .finally(() => {
          running--;
          waiting.shift()?.();
        });
    };
    if (running < MAX_PARALLEL) start();
    else waiting.push(start);
  });
}

function resolveQuality(kind: OfflineKind): StreamQuality {
  const s = getSettings();
  if (kind === 'download') return s.downloadQuality === 'high' ? 'high' : 'normal';
  if (s.streamQuality === 'auto') return getNetState().unmetered ? 'high' : 'normal';
  return s.streamQuality;
}

async function fetchTo(url: string, dest: string, onProgress?: (p: number) => void) {
  const task = FileSystem.createDownloadResumable(url, dest, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const res = await task.downloadAsync();
  if (!res || res.status < 200 || res.status >= 300) throw new Error(`Download failed (${res?.status})`);
  return res.uri;
}

/**
 * Save a track on the device. Resolves true when it is (now) available offline.
 * Already-saved tracks are reused; a cached track asked to be a download is promoted.
 */
export async function saveOffline(track: Track, kind: OfflineKind): Promise<boolean> {
  await initOffline();
  if (!ROOT) return false;

  const existing = entries[track.id];
  if (existing) {
    if (kind === 'download' && existing.kind === 'cache') {
      existing.kind = 'download';
      existing.savedAt = Date.now();
      emit();
      persist();
    }
    return true;
  }

  const pending = inflight.get(track.id);
  if (pending) return pending;

  const url = pickStreamUrl(track, resolveQuality(kind));
  if (!url) return false;

  const job = withSlot(async () => {
    const base = `${ROOT}${safeName(track.id)}`;
    const audioPath = `${base}.${extensionOf(url)}`;
    const part = `${audioPath}.part`;
    try {
      progress[track.id] = 0;
      emitProgress(true);
      await fetchTo(url, part, (p) => {
        progress[track.id] = p;
        emitProgress();
      });
      await FileSystem.moveAsync({ from: part, to: audioPath });
      const info = await FileSystem.getInfoAsync(audioPath);
      if (!info.exists) throw new Error('File missing after download');

      let artUri: string | undefined;
      const art = track.image?.length ? track.image[track.image.length > 1 ? 1 : 0].url : undefined;
      if (art && /^https?:/.test(art)) {
        try {
          artUri = await fetchTo(art, `${base}.jpg`);
        } catch {
          // artwork is optional
        }
      }

      const now = Date.now();
      entries[track.id] = {
        track: { ...track, localUri: undefined },
        uri: audioPath,
        artUri,
        bytes: (info as { size?: number }).size ?? 0,
        kind,
        savedAt: now,
        lastPlayedAt: now,
      };
      delete progress[track.id];
      emit();
      persist();
      void evictIfNeeded(track.id);
      return true;
    } catch (e) {
      delete progress[track.id];
      emitProgress(true);
      FileSystem.deleteAsync(part, { idempotent: true }).catch(() => {});
      if (kind === 'download') throw e;
      return false;
    }
  }).finally(() => {
    inflight.delete(track.id);
  });

  inflight.set(track.id, job);
  return job;
}

/** Whether we are allowed to use mobile data for offline saving right now. */
export function canSaveOnCurrentNetwork(): boolean {
  const net = getNetState();
  return net.online && (net.unmetered || getSettings().useCellularForOffline);
}

/** Auto-cache a song that is playing; silent and best-effort. */
export function cacheWhilePlaying(track: Track) {
  if (!getSettings().autoCache || !canSaveOnCurrentNetwork()) return;
  if (entries[track.id] || inflight.has(track.id)) return;
  void saveOffline(track, 'cache').catch(() => {});
}

export function touchPlayed(id: string) {
  const e = entries[id];
  if (!e) return;
  e.lastPlayedAt = Date.now();
  persist();
}

export async function removeOffline(id: string) {
  await initOffline();
  const e = entries[id];
  if (!e) return;
  delete entries[id];
  emit();
  persist();
  await FileSystem.deleteAsync(e.uri, { idempotent: true }).catch(() => {});
  if (e.artUri) await FileSystem.deleteAsync(e.artUri, { idempotent: true }).catch(() => {});
}

export async function clearOffline(kind: OfflineKind) {
  await initOffline();
  const ids = Object.keys(entries).filter((id) => entries[id].kind === kind);
  await Promise.all(ids.map(removeOffline));
}

async function evictIfNeeded(protectId?: string) {
  const limit = getSettings().cacheLimitMB * 1024 * 1024;
  const cached = Object.entries(entries)
    .filter(([, e]) => e.kind === 'cache')
    .sort((a, b) => a[1].lastPlayedAt - b[1].lastPlayedAt);
  let total = cached.reduce((sum, [, e]) => sum + e.bytes, 0);
  for (const [id, e] of cached) {
    if (total <= limit) break;
    if (id === protectId) continue;
    total -= e.bytes;
    await removeOffline(id);
  }
}

export const enforceCacheLimit = () => evictIfNeeded();

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
