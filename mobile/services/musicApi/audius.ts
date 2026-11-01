import { requestJson } from './http';
import { compact, normalizeAudiusTrack } from './normalize';
import type { Track } from './types';

/**
 * Audius (https://audius.co) is a free, open music network with an official
 * public API meant for third-party apps and full-length streams. It is used as
 * the safety net when the JioSaavn wrapper is unreachable. Its catalogue is
 * independent artists, so it will not have mainstream Bollywood releases.
 */
const HOSTS = ['https://api.audius.co', 'https://discoveryprovider.audius.co'];
const APP_NAME = 'raga';

async function get<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const json = await requestJson<{ data: T }>(HOSTS, `${path}${sep}app_name=${APP_NAME}`, {
    timeoutMs: 10_000,
    validate: (j) => j?.data != null,
  });
  return json.data;
}

const toTracks = (list: any): Track[] =>
  compact(Array.isArray(list) ? list.map((t) => normalizeAudiusTrack(t, HOSTS[0], APP_NAME)) : []);

export const audius = {
  async searchSongs(query: string, limit = 20): Promise<Track[]> {
    // Some results are not streamable and get filtered out, so over-fetch.
    const raw = await get<any>(`/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit * 2}`);
    return toTracks(raw).slice(0, limit);
  },

  async trending(limit = 20, genre?: string): Promise<Track[]> {
    const g = genre ? `&genre=${encodeURIComponent(genre)}` : '';
    return toTracks(await get<any>(`/v1/tracks/trending?limit=${limit * 2}${g}`)).slice(0, limit);
  },
};
