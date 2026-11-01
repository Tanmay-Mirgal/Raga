import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode as NativeRepeat,
  State,
  type AddTrack,
} from 'react-native-track-player';
import {
  allArtistNames,
  getRadio,
  pickImage,
  pickStreamUrl,
  refreshTrack,
  type StreamQuality,
  type Track,
} from '../services/musicApi';
import { fetchWithTimeout } from '../services/musicApi/http';
import { skipNext, skipPrevious } from '../services/playerControls';
import { getNetState, isOnline, startNetworkMonitor, useNetwork } from '../utils/network';
import {
  cacheWhilePlaying,
  getOfflineTrack,
  initOffline,
  isAvailableOffline,
  removeOffline,
  saveOffline,
  canSaveOnCurrentNetwork,
  touchPlayed,
  useOfflineStructure,
} from '../utils/offline';
import { getSettings, loadSettings } from '../utils/settings';
import { getPlaybackProgress, setPlaybackProgress } from './playbackProgress';

export type { Track };
export type RepeatMode = 'off' | 'all' | 'one';

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  queue: Track[];
  currentIndex: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  /** true for both repeat-all and repeat-one */
  isRepeat: boolean;
  playbackRate: number;
  downloadedTracks: Track[];
  likedSongs: Track[];
  recentlyPlayed: Track[];
  sleepTimerTimeLeft: number | null;
  sleepAtEndOfTrack: boolean;

  playTrack: (track: Track, newQueue?: Track[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  toggleRepeat: () => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;

  playNext: (track: Track) => Promise<void>;
  addToQueue: (track: Track) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  moveQueueItem: (from: number, to: number) => Promise<void>;
  skipToQueueIndex: (index: number) => Promise<void>;
  startRadio: (seed: Track) => Promise<void>;

  downloadTrack: (track: Track) => Promise<boolean>;
  removeDownload: (trackId: string) => Promise<void>;
  refreshDownloads: () => Promise<void>;

  logInteraction: (track: Track, type: string) => Promise<void>;
  toggleLikeTrack: (track: Track) => Promise<void>;
  fetchLikedSongs: () => Promise<void>;

  setSleepTimer: (minutes: number | null) => void;
  setSleepTimerEndOfTrack: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const API = process.env.EXPO_PUBLIC_API_BASE_URL;
const KEYS = {
  likes: 'raga:likes:v1',
  pendingLikes: 'raga:likes:pending:v1',
  recent: 'raga:recent:v1',
  session: 'raga:session:v1',
  askedNotifications: 'raga:asked-notifications',
};
const RECENT_LIMIT = 50;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const shuffled = <T,>(list: T[]): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const dedupe = (list: Track[]): Track[] => {
  const seen = new Set<string>();
  return list.filter((t) => {
    if (!t?.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
};

const readJson = async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
};

const offlineOnly = () => getSettings().offlineMode || !isOnline();

const streamQuality = (): StreamQuality => {
  const q = getSettings().streamQuality;
  if (q === 'auto') return getNetState().unmetered ? 'high' : 'normal';
  return q;
};

/** App track -> native player track. The full app track rides along as `raga`. */
function toNativeTrack(track: Track): (AddTrack & { raga: Track }) | null {
  const offline = getOfflineTrack(track.id);
  const url = offline?.localUri ?? track.localUri ?? pickStreamUrl(track, streamQuality());
  if (!url) return null;
  const localArt = offline?.image?.[0]?.url;
  return {
    id: track.id,
    url,
    title: track.name,
    artist: allArtistNames(track),
    album: track.album?.name,
    artwork: localArt?.startsWith('file') ? localArt : pickImage(track.image, 'lg'),
    duration: track.duration,
    raga: track,
  };
}

const repeatToNative = (mode: RepeatMode) =>
  mode === 'one' ? NativeRepeat.Track : mode === 'all' ? NativeRepeat.Queue : NativeRepeat.Off;

const repeatFromNative = (mode: NativeRepeat): RepeatMode =>
  mode === NativeRepeat.Track ? 'one' : mode === NativeRepeat.Queue ? 'all' : 'off';

let setupPromise: Promise<void> | null = null;

/** One-time native player setup (notification buttons, buffering, interruption handling). */
export function ensurePlayerSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = (async () => {
      try {
        await TrackPlayer.setupPlayer({
          autoHandleInterruptions: true, // pause for calls, duck for notifications
          androidAudioContentType: AndroidAudioContentType.Music,
          minBuffer: 15,
          maxBuffer: 50,
          playBuffer: 2.5,
          backBuffer: 30,
        });
      } catch (e) {
        // Happens after a JS reload while the native service is still alive: that is fine.
        if (!/already been initialized/i.test(String((e as Error)?.message))) throw e;
      }
      await TrackPlayer.updateOptions({
        android: { appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
        progressUpdateEventInterval: 1,
      });
    })().catch((e) => {
      setupPromise = null; // allow a retry on the next play
      throw e;
    });
  }
  return setupPromise;
}

async function askNotificationPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try {
    if (await AsyncStorage.getItem(KEYS.askedNotifications)) return;
    await AsyncStorage.setItem(KEYS.askedNotifications, '1');
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // The player still works without it; only the notification may be hidden.
  }
}

type PendingLike = { op: 'like' | 'unlike'; track: Track };

// ---------------------------------------------------------------------------
// provider
// ---------------------------------------------------------------------------

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const userIdRef = useRef<string | undefined>(undefined);
  userIdRef.current = user?.id;

  const offline = useOfflineStructure();

  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [likedSongs, setLikedSongs] = useState<Track[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [sleepTimerTimeLeft, setSleepTimerTimeLeft] = useState<number | null>(null);
  const [sleepAtEndOfTrack, setSleepAtEndOfTrack] = useState(false);

  // Mirrors of state for use inside long-lived event handlers.
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const trackRef = useRef<Track | null>(null);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>('off');
  const likedRef = useRef<Track[]>([]);
  const originalOrderRef = useRef<Track[]>([]);
  const nativeStateRef = useRef<State>(State.None);
  const playWhenReadyRef = useRef(false);
  const requestRef = useRef(0);
  const retriedRef = useRef<Set<string>>(new Set());
  const autoplayBusyRef = useRef(false);
  const sleepEndsAtRef = useRef<number | null>(null);
  const sleepEndOfTrackRef = useRef(false);
  const sleepTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setQueueBoth = (q: Track[]) => {
    queueRef.current = q;
    setQueue(q);
  };
  const setIndexBoth = (i: number) => {
    indexRef.current = i;
    setCurrentIndex(i);
  };
  const setTrackBoth = (t: Track | null) => {
    trackRef.current = t;
    setCurrentTrack(t);
  };
  const setShuffleBoth = (v: boolean) => {
    shuffleRef.current = v;
    setIsShuffle(v);
  };
  const setRepeatBoth = (v: RepeatMode) => {
    repeatRef.current = v;
    setRepeatMode(v);
  };

  const actions = useMemo(() => {
    // ---- server helpers --------------------------------------------------
    const server = (path: string, init?: RequestInit) => fetchWithTimeout(`${API}${path}`, 20_000, init);

    const logInteraction = async (track: Track, type: string) => {
      const userId = userIdRef.current;
      if (!userId || !isOnline()) return;
      try {
        await server('/api/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, track, interactionType: type }),
        });
      } catch {
        // analytics only; never block playback
      }
    };

    // ---- likes (works offline, syncs later) --------------------------------
    const flushPendingLikes = async () => {
      const userId = userIdRef.current;
      if (!userId || !isOnline()) return;
      const pending = await readJson<PendingLike[]>(KEYS.pendingLikes, []);
      const remaining: PendingLike[] = [];
      for (const p of pending) {
        try {
          const res =
            p.op === 'like'
              ? await server('/api/likes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, track: p.track }),
                })
              : await server(`/api/likes?userId=${userId}&songId=${encodeURIComponent(p.track.id)}`, {
                  method: 'DELETE',
                });
          if (!res.ok) remaining.push(p);
        } catch {
          remaining.push(p);
        }
      }
      writeJson(KEYS.pendingLikes, remaining);
    };

    const fetchLikedSongs = async () => {
      const userId = userIdRef.current;
      if (!userId || !isOnline()) return;
      try {
        await flushPendingLikes();
        const res = await server(`/api/likes?userId=${userId}`);
        if (!res.ok) return;
        const data = (await res.json()) as Track[];
        const unique = dedupe(data);
        likedRef.current = unique;
        setLikedSongs(unique);
        writeJson(KEYS.likes, unique);
      } catch (e) {
        console.log('Could not refresh liked songs:', (e as Error)?.message);
      }
    };

    const toggleLikeTrack = async (track: Track) => {
      const userId = userIdRef.current;
      if (!userId) return;
      const wasLiked = likedRef.current.some((t) => t.id === track.id);
      const next = wasLiked
        ? likedRef.current.filter((t) => t.id !== track.id)
        : [track, ...likedRef.current];
      likedRef.current = next;
      setLikedSongs(next);
      writeJson(KEYS.likes, next);

      const op: PendingLike = { op: wasLiked ? 'unlike' : 'like', track };
      let synced = false;
      if (isOnline()) {
        try {
          const res = wasLiked
            ? await server(`/api/likes?userId=${userId}&songId=${encodeURIComponent(track.id)}`, { method: 'DELETE' })
            : await server('/api/likes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, track }),
              });
          synced = res.ok;
        } catch {
          synced = false;
        }
      }
      if (!synced) {
        const pending = await readJson<PendingLike[]>(KEYS.pendingLikes, []);
        writeJson(KEYS.pendingLikes, [...pending.filter((p) => p.track.id !== track.id), op]);
      } else {
        void logInteraction(track, wasLiked ? 'unlike' : 'like');
      }
    };

    // ---- native <-> JS state ------------------------------------------------
    const recomputePlaying = () => {
      const st = nativeStateRef.current;
      const dead = st === State.Ended || st === State.Error || st === State.None || st === State.Stopped;
      setIsPlaying(playWhenReadyRef.current && !dead);
      setIsBuffering(st === State.Buffering || st === State.Loading);
    };

    /** Rebuild JS state from the native queue (the single source of truth). */
    const syncQueueFromNative = async () => {
      const native = await TrackPlayer.getQueue();
      const tracks = native.map((t) => (t as { raga?: Track }).raga).filter((t): t is Track => !!t);
      const idx = (await TrackPlayer.getActiveTrackIndex()) ?? -1;
      setQueueBoth(tracks);
      setIndexBoth(idx);
      setTrackBoth(idx >= 0 ? (tracks[idx] ?? null) : null);
      if (originalOrderRef.current.length === 0) originalOrderRef.current = tracks;
      return tracks;
    };

    const syncPlaybackFromNative = async () => {
      const [state, pwr, progress, repeat, rate] = await Promise.all([
        TrackPlayer.getPlaybackState(),
        TrackPlayer.getPlayWhenReady(),
        TrackPlayer.getProgress(),
        TrackPlayer.getRepeatMode(),
        TrackPlayer.getRate(),
      ]);
      nativeStateRef.current = state.state;
      playWhenReadyRef.current = pwr;
      recomputePlaying();
      setPlaybackProgress({
        position: progress.position * 1000,
        duration: progress.duration * 1000 || (trackRef.current?.duration ?? 0) * 1000,
        buffered: progress.buffered * 1000,
      });
      setRepeatBoth(repeatFromNative(repeat));
      setPlaybackRateState(rate);
    };

    const saveSession = async () => {
      if (queueRef.current.length === 0) return;
      let positionMs = getPlaybackProgress().position;
      try {
        positionMs = (await TrackPlayer.getProgress()).position * 1000;
      } catch {
        // use the last known position
      }
      writeJson(KEYS.session, {
        tracks: queueRef.current,
        index: indexRef.current,
        positionMs,
        shuffle: shuffleRef.current,
        repeat: repeatRef.current,
      });
    };

    const addRecent = (track: Track) => {
      setRecentlyPlayed((prev) => {
        const next = [track, ...prev.filter((t) => t.id !== track.id)].slice(0, RECENT_LIMIT);
        writeJson(KEYS.recent, next);
        return next;
      });
    };

    // ---- sleep timer ---------------------------------------------------------
    const clearSleepTimer = () => {
      sleepEndsAtRef.current = null;
      sleepEndOfTrackRef.current = false;
      setSleepTimerTimeLeft(null);
      setSleepAtEndOfTrack(false);
      if (sleepTickRef.current) {
        clearInterval(sleepTickRef.current);
        sleepTickRef.current = null;
      }
    };

    const checkSleepTimer = () => {
      const endsAt = sleepEndsAtRef.current;
      if (endsAt == null) return;
      const left = Math.ceil((endsAt - Date.now()) / 1000);
      if (left <= 0) {
        clearSleepTimer();
        TrackPlayer.pause().catch(() => {});
      } else {
        setSleepTimerTimeLeft(left);
      }
    };

    const setSleepTimer = (minutes: number | null) => {
      clearSleepTimer();
      if (minutes == null) return;
      sleepEndsAtRef.current = Date.now() + minutes * 60_000;
      setSleepTimerTimeLeft(minutes * 60);
      sleepTickRef.current = setInterval(checkSleepTimer, 1000);
    };

    const setSleepTimerEndOfTrack = () => {
      clearSleepTimer();
      sleepEndOfTrackRef.current = true;
      setSleepAtEndOfTrack(true);
    };

    // ---- autoplay -------------------------------------------------------------
    const extendWithRadio = async (seed: Track) => {
      if (autoplayBusyRef.current || !isOnline() || getSettings().offlineMode) return;
      autoplayBusyRef.current = true;
      try {
        const have = new Set(queueRef.current.map((t) => t.id));
        const fresh = (await getRadio(seed, 20)).filter((t) => !have.has(t.id)).slice(0, 15);
        const native = fresh.map(toNativeTrack).filter((t): t is NonNullable<typeof t> => !!t);
        if (native.length === 0) return;
        await TrackPlayer.add(native);
        await syncQueueFromNative();
      } catch {
        // autoplay is a convenience; ignore failures
      } finally {
        autoplayBusyRef.current = false;
      }
    };

    // ---- playback lifecycle -------------------------------------------------------
    const onTrackStarted = (track: Track, index: number) => {
      retriedRef.current.delete(track.id);
      addRecent(track);
      touchPlayed(track.id);
      void logInteraction(track, 'play');
      cacheWhilePlaying(track); // so it can be replayed offline
      const upcoming = queueRef.current[index + 1];
      if (upcoming) cacheWhilePlaying(upcoming); // warm the next song too
      if (getSettings().autoplay && repeatRef.current === 'off' && queueRef.current.length - index <= 2) {
        void extendWithRadio(track);
      }
      void saveSession();
    };

    /** Replace a failing stream with a fresh URL (or skip it) after a playback error. */
    const recoverFromError = async () => {
      const index = (await TrackPlayer.getActiveTrackIndex()) ?? -1;
      const track = index >= 0 ? queueRef.current[index] : null;
      if (!track) return;

      if (isOnline() && !retriedRef.current.has(track.id)) {
        retriedRef.current.add(track.id);
        const fresh = await refreshTrack(track);
        const native = fresh ? toNativeTrack(fresh) : null;
        if (native) {
          await TrackPlayer.remove(index);
          await TrackPlayer.add(native, index);
          await TrackPlayer.skip(index);
          await TrackPlayer.play();
          await syncQueueFromNative();
          return;
        }
      }
      // Cannot play this one (offline / dead link): move on rather than get stuck.
      if (index < queueRef.current.length - 1) {
        await TrackPlayer.skipToNext();
        await TrackPlayer.play();
      } else {
        await TrackPlayer.pause();
      }
    };

    const startQueue = async (track: Track, list: Track[]) => {
      const requestId = ++requestRef.current;
      await ensurePlayerSetup();
      void askNotificationPermission();

      let candidates = dedupe(list.length > 0 ? list : [track]);
      if (!candidates.some((t) => t.id === track.id)) candidates = [track, ...candidates];

      if (offlineOnly()) {
        candidates = candidates.filter((t) => isAvailableOffline(t.id));
        if (!candidates.some((t) => t.id === track.id)) {
          Alert.alert(
            "You're offline",
            'This song is not saved on your device yet. Songs you have played or downloaded will work offline.'
          );
          return;
        }
      }

      originalOrderRef.current = candidates;
      const ordered = shuffleRef.current
        ? [track, ...shuffled(candidates.filter((t) => t.id !== track.id))]
        : candidates;
      const playable = ordered.filter((t) => toNativeTrack(t));
      const native = playable.map((t) => toNativeTrack(t)!);
      const startIdx = playable.findIndex((t) => t.id === track.id);
      if (startIdx < 0) {
        Alert.alert('Cannot play', 'No playable audio found for this song.');
        return;
      }

      await TrackPlayer.setQueue(native);
      if (requestId !== requestRef.current) return; // a newer tap won
      await TrackPlayer.setRepeatMode(repeatToNative(repeatRef.current));
      await TrackPlayer.skip(startIdx);
      await TrackPlayer.play();

      setQueueBoth(playable);
      setIndexBoth(startIdx);
      setTrackBoth(track);
      setPlaybackProgress({ position: 0, duration: (track.duration ?? 0) * 1000, buffered: 0 });
    };

    const restoreSession = async () => {
      const session = await readJson<{
        tracks: Track[];
        index: number;
        positionMs: number;
        shuffle: boolean;
        repeat: RepeatMode;
      } | null>(KEYS.session, null);
      if (!session || !Array.isArray(session.tracks) || session.tracks.length === 0) return;

      let tracks = session.tracks;
      let index = Math.min(Math.max(session.index, 0), tracks.length - 1);
      const current = tracks[index];
      if (offlineOnly()) {
        tracks = tracks.filter((t) => isAvailableOffline(t.id));
        index = tracks.findIndex((t) => t.id === current.id);
        if (index < 0) return;
      }
      const playable = tracks.filter((t) => toNativeTrack(t));
      index = playable.findIndex((t) => t.id === current.id);
      if (index < 0) return;

      setShuffleBoth(!!session.shuffle);
      setRepeatBoth(session.repeat ?? 'off');
      originalOrderRef.current = playable;
      await TrackPlayer.setQueue(playable.map((t) => toNativeTrack(t)!));
      await TrackPlayer.setRepeatMode(repeatToNative(session.repeat ?? 'off'));
      await TrackPlayer.skip(index, Math.max(0, (session.positionMs ?? 0) / 1000));
      await syncQueueFromNative();
      await syncPlaybackFromNative();
    };

    // ---- public actions --------------------------------------------------------------
    const playTrack = async (track: Track, newQueue?: Track[]) => {
      try {
        const existing = queueRef.current;
        const list = newQueue ?? (existing.length > 0 ? existing : [track]);
        await startQueue(track, list);
      } catch (e) {
        console.error('[player] playTrack failed:', e);
        Alert.alert('Playback error', 'Could not start this song. Please try again.');
      }
    };

    const togglePlay = async () => {
      try {
        await ensurePlayerSetup();
        const state = (await TrackPlayer.getPlaybackState()).state;
        if (state === State.Ended) {
          await TrackPlayer.skip(0);
          await TrackPlayer.play();
        } else if (state === State.Error) {
          await TrackPlayer.retry();
        } else if (await TrackPlayer.getPlayWhenReady()) {
          await TrackPlayer.pause();
          void saveSession();
        } else {
          await TrackPlayer.play();
        }
      } catch (e) {
        console.error('[player] togglePlay failed:', e);
      }
    };

    const seekTo = async (millis: number) => {
      setPlaybackProgress({ position: millis });
      try {
        await TrackPlayer.seekTo(millis / 1000);
      } catch (e) {
        console.error('[player] seek failed:', e);
      }
    };

    const skipToNext = async () => {
      const t = trackRef.current;
      if (t && getPlaybackProgress().position < 10_000) void logInteraction(t, 'skip');
      await skipNext();
    };

    const skipToPrevious = async () => {
      await skipPrevious();
    };

    const toggleShuffle = async () => {
      const turningOn = !shuffleRef.current;
      setShuffleBoth(turningOn);
      const current = trackRef.current;
      if (!current || queueRef.current.length < 2) return;
      try {
        const queueNow = queueRef.current;
        const activeIdx = indexRef.current;
        const upcoming = queueNow.slice(activeIdx + 1);
        // Rebuild only what comes after the current song so playback never glitches.
        let nextUpcoming: Track[];
        if (turningOn) {
          nextUpcoming = shuffled(upcoming);
        } else {
          const original = originalOrderRef.current;
          const pos = original.findIndex((t) => t.id === current.id);
          const inQueue = new Set(queueNow.map((t) => t.id));
          nextUpcoming = (pos >= 0 ? original.slice(pos + 1) : upcoming).filter((t) => inQueue.has(t.id));
        }
        await TrackPlayer.removeUpcomingTracks();
        const native = nextUpcoming.map(toNativeTrack).filter((t): t is NonNullable<typeof t> => !!t);
        if (native.length) await TrackPlayer.add(native);
        await syncQueueFromNative();
        void saveSession();
      } catch (e) {
        console.error('[player] shuffle failed:', e);
      }
    };

    const toggleRepeat = async () => {
      const next: RepeatMode = repeatRef.current === 'off' ? 'all' : repeatRef.current === 'all' ? 'one' : 'off';
      setRepeatBoth(next);
      try {
        await TrackPlayer.setRepeatMode(repeatToNative(next));
      } catch (e) {
        console.error('[player] repeat failed:', e);
      }
    };

    const setPlaybackRate = async (rate: number) => {
      setPlaybackRateState(rate);
      try {
        await TrackPlayer.setRate(rate);
      } catch (e) {
        console.error('[player] rate failed:', e);
      }
    };

    const insertIntoQueue = async (track: Track, atEnd: boolean) => {
      if (queueRef.current.length === 0 || !trackRef.current) {
        await playTrack(track, [track]);
        return;
      }
      if (offlineOnly() && !isAvailableOffline(track.id)) {
        Alert.alert("You're offline", 'This song is not saved on your device.');
        return;
      }
      const native = toNativeTrack(track);
      if (!native) return;
      try {
        if (atEnd) await TrackPlayer.add(native);
        else await TrackPlayer.add(native, indexRef.current + 1);
        originalOrderRef.current = atEnd
          ? [...originalOrderRef.current, track]
          : (() => {
              const o = [...originalOrderRef.current];
              const pos = o.findIndex((t) => t.id === trackRef.current?.id);
              o.splice(pos >= 0 ? pos + 1 : o.length, 0, track);
              return o;
            })();
        await syncQueueFromNative();
      } catch (e) {
        console.error('[player] add to queue failed:', e);
      }
    };

    const removeFromQueue = async (index: number) => {
      if (index < 0 || index >= queueRef.current.length) return;
      try {
        const removed = queueRef.current[index];
        await TrackPlayer.remove(index);
        originalOrderRef.current = originalOrderRef.current.filter((t) => t.id !== removed.id);
        await syncQueueFromNative();
      } catch (e) {
        console.error('[player] remove failed:', e);
      }
    };

    const moveQueueItem = async (from: number, to: number) => {
      const len = queueRef.current.length;
      if (from === to || from < 0 || to < 0 || from >= len || to >= len) return;
      try {
        await TrackPlayer.move(from, to);
        await syncQueueFromNative();
      } catch (e) {
        console.error('[player] move failed:', e);
      }
    };

    const skipToQueueIndex = async (index: number) => {
      try {
        await TrackPlayer.skip(index);
        await TrackPlayer.play();
      } catch (e) {
        console.error('[player] skip failed:', e);
      }
    };

    const startRadio = async (seed: Track) => {
      try {
        const similar = await getRadio(seed, 25);
        await playTrack(seed, [seed, ...similar.filter((t) => t.id !== seed.id)]);
      } catch {
        Alert.alert('Radio unavailable', 'Could not find similar songs right now. Try again when you are online.');
      }
    };

    // ---- downloads ----------------------------------------------------------------------
    const downloadTrack = async (track: Track): Promise<boolean> => {
      if (isAvailableOffline(track.id)) return saveOffline(track, 'download');
      if (!canSaveOnCurrentNetwork()) {
        Alert.alert(
          isOnline() ? 'Wi-Fi only' : "You're offline",
          isOnline()
            ? 'Downloads over mobile data are turned off. You can allow them in Settings.'
            : 'Connect to the internet to download songs.'
        );
        return false;
      }
      return saveOffline(track, 'download');
    };

    return {
      logInteraction,
      fetchLikedSongs,
      flushPendingLikes,
      toggleLikeTrack,
      recomputePlaying,
      syncQueueFromNative,
      syncPlaybackFromNative,
      saveSession,
      restoreSession,
      onTrackStarted,
      recoverFromError,
      checkSleepTimer,
      clearSleepTimer,
      sleepEndOfTrackRef,
      playTrack,
      togglePlay,
      seekTo,
      skipToNext,
      skipToPrevious,
      toggleShuffle,
      toggleRepeat,
      setPlaybackRate,
      playNext: (track: Track) => insertIntoQueue(track, false),
      addToQueue: (track: Track) => insertIntoQueue(track, true),
      removeFromQueue,
      moveQueueItem,
      skipToQueueIndex,
      startRadio,
      downloadTrack,
      removeDownload: removeOffline,
      setSleepTimer,
      setSleepTimerEndOfTrack,
    };
    // Everything inside reads refs / stable setters, so it is created once.
  }, []);

  // ---- boot: settings, offline store, native player, restore -------------------
  useEffect(() => {
    let cancelled = false;

    const subs = [
      TrackPlayer.addEventListener(Event.PlaybackState, (e) => {
        nativeStateRef.current = e.state;
        actions.recomputePlaying();
      }),
      TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, (e) => {
        playWhenReadyRef.current = e.playWhenReady;
        actions.recomputePlaying();
      }),
      TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (e) => {
        if (e.index == null) return;
        const track = (e.track as { raga?: Track } | undefined)?.raga ?? queueRef.current[e.index];
        setIndexBoth(e.index);
        setTrackBoth(track ?? null);
        setPlaybackProgress({ position: 0, duration: (track?.duration ?? 0) * 1000, buffered: 0 });
        if (!track) return;
        if (actions.sleepEndOfTrackRef.current && e.lastTrack) {
          actions.clearSleepTimer();
          TrackPlayer.pause().then(() => TrackPlayer.seekTo(0)).catch(() => {});
        }
        // Loading a queue briefly activates track 0 before we skip to the chosen song, and
        // skipping through the queue is not "listening". Only count a song that stays active
        // for a moment and is actually playing.
        if (startTimerRef.current) clearTimeout(startTimerRef.current);
        const startedIndex = e.index;
        startTimerRef.current = setTimeout(() => {
          if (indexRef.current === startedIndex && playWhenReadyRef.current) actions.onTrackStarted(track, startedIndex);
        }, 800);
      }),
      TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (e) => {
        setPlaybackProgress({
          position: e.position * 1000,
          duration: e.duration > 0 ? e.duration * 1000 : (trackRef.current?.duration ?? 0) * 1000,
          buffered: e.buffered * 1000,
        });
        actions.checkSleepTimer();
      }),
      TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
        if (actions.sleepEndOfTrackRef.current) actions.clearSleepTimer();
        void actions.saveSession();
      }),
      TrackPlayer.addEventListener(Event.PlaybackError, (e) => {
        console.warn('[player] playback error:', e.code, e.message);
        void actions.recoverFromError().catch(() => {});
      }),
    ];

    const appStateSub = AppState.addEventListener('change', (status) => {
      if (status === 'background') void actions.saveSession();
      if (status === 'active') {
        // JS may have been suspended while the native queue moved on.
        void actions.syncQueueFromNative().then(actions.syncPlaybackFromNative).catch(() => {});
        void actions.flushPendingLikes();
      }
    });

    (async () => {
      await Promise.all([loadSettings(), initOffline()]);
      startNetworkMonitor();
      const [likes, recent] = await Promise.all([
        readJson<Track[]>(KEYS.likes, []),
        readJson<Track[]>(KEYS.recent, []),
      ]);
      if (cancelled) return;
      likedRef.current = likes;
      setLikedSongs(likes);
      setRecentlyPlayed(recent);

      try {
        await ensurePlayerSetup();
        const native = await TrackPlayer.getQueue();
        if (native.length > 0) {
          // The service outlived the UI (app reopened from the notification): adopt its state.
          await actions.syncQueueFromNative();
          await actions.syncPlaybackFromNative();
        } else {
          await actions.restoreSession();
        }
      } catch (e) {
        console.warn('[player] setup/restore failed:', (e as Error)?.message);
      }
    })();

    return () => {
      cancelled = true;
      subs.forEach((s) => s.remove());
      appStateSub.remove();
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      actions.clearSleepTimer();
    };
  }, [actions]);

  // Refresh likes whenever the signed-in user changes.
  const userId = user?.id;
  useEffect(() => {
    if (userId) void actions.fetchLikedSongs();
    else {
      likedRef.current = [];
      setLikedSongs([]);
    }
  }, [userId, actions]);

  // Retry unsynced likes when connectivity returns.
  const { online } = useNetwork();
  useEffect(() => {
    if (online) void actions.flushPendingLikes();
  }, [online, actions]);

  const value = useMemo<AudioContextType>(
    () => ({
      currentTrack,
      isPlaying,
      isBuffering,
      queue,
      currentIndex,
      isShuffle,
      repeatMode,
      isRepeat: repeatMode !== 'off',
      playbackRate,
      downloadedTracks: offline.downloads,
      likedSongs,
      recentlyPlayed,
      sleepTimerTimeLeft,
      sleepAtEndOfTrack,
      playTrack: actions.playTrack,
      togglePlay: actions.togglePlay,
      seekTo: actions.seekTo,
      skipToNext: actions.skipToNext,
      skipToPrevious: actions.skipToPrevious,
      toggleShuffle: actions.toggleShuffle,
      toggleRepeat: actions.toggleRepeat,
      setPlaybackRate: actions.setPlaybackRate,
      playNext: actions.playNext,
      addToQueue: actions.addToQueue,
      removeFromQueue: actions.removeFromQueue,
      moveQueueItem: actions.moveQueueItem,
      skipToQueueIndex: actions.skipToQueueIndex,
      startRadio: actions.startRadio,
      downloadTrack: actions.downloadTrack,
      removeDownload: actions.removeDownload,
      refreshDownloads: async () => {},
      logInteraction: actions.logInteraction,
      toggleLikeTrack: actions.toggleLikeTrack,
      fetchLikedSongs: actions.fetchLikedSongs,
      setSleepTimer: actions.setSleepTimer,
      setSleepTimerEndOfTrack: actions.setSleepTimerEndOfTrack,
    }),
    [
      currentTrack,
      isPlaying,
      isBuffering,
      queue,
      currentIndex,
      isShuffle,
      repeatMode,
      playbackRate,
      offline.downloads,
      likedSongs,
      recentlyPlayed,
      sleepTimerTimeLeft,
      sleepAtEndOfTrack,
      actions,
    ]
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
