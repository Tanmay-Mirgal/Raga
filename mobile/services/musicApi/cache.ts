import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Two-level (memory + AsyncStorage) response cache with:
 *  - TTL freshness
 *  - stale-if-error: when the network/API fails we serve the last good copy,
 *    however old, so browsing keeps working offline or while an API is down
 *  - in-flight request de-duplication
 */

const PREFIX = 'raga:c:';
const INDEX_KEY = 'raga:c:__index';
const MAX_PERSISTED = 150;

interface Entry<T> {
  t: number;
  d: T;
}

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
let indexCache: string[] | null = null;

export const TTL = {
  search: 10 * 60_000,
  detail: 6 * 3_600_000,
  home: 30 * 60_000,
  suggestions: 30 * 60_000,
};

async function readIndex(): Promise<string[]> {
  if (indexCache) return indexCache;
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    indexCache = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    indexCache = [];
  }
  return indexCache;
}

async function persist<T>(key: string, entry: Entry<T>) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
    const index = await readIndex();
    const next = [key, ...index.filter((k) => k !== key)];
    const evicted = next.splice(MAX_PERSISTED);
    indexCache = next;
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
    if (evicted.length) await AsyncStorage.multiRemove(evicted.map((k) => PREFIX + k));
  } catch {
    // storage full or unavailable: caching is best-effort
  }
}

async function load<T>(key: string): Promise<Entry<T> | null> {
  const hit = memory.get(key) as Entry<T> | undefined;
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    memory.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = await load<T>(key);
  if (entry && Date.now() - entry.t < ttlMs) return entry.d;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const run = (async () => {
    try {
      const data = await fetcher();
      const fresh: Entry<T> = { t: Date.now(), d: data };
      memory.set(key, fresh);
      void persist(key, fresh);
      return data;
    } catch (e) {
      if (entry) return entry.d; // stale-if-error
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, run);
  return run;
}

/** Read whatever is cached for a key without hitting the network. */
export async function peek<T>(key: string): Promise<T | null> {
  const entry = await load<T>(key);
  return entry ? entry.d : null;
}

export async function clearApiCache() {
  memory.clear();
  inflight.clear();
  try {
    const index = await readIndex();
    await AsyncStorage.multiRemove([...index.map((k) => PREFIX + k), INDEX_KEY]);
  } catch {
    // ignore
  }
  indexCache = [];
}
