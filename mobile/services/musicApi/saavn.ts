import { requestJson } from './http';
import {
  compact,
  decodeEntities,
  normalizeAlbum,
  normalizeArtist,
  normalizePlaylist,
  normalizeSaavnTrack,
} from './normalize';
import type {
  AlbumDetail,
  AlbumSummary,
  ArtistDetail,
  ArtistSummary,
  PlaylistDetail,
  PlaylistSummary,
  SearchAllResult,
  Track,
} from './types';

/**
 * JioSaavn-compatible REST wrapper (https://github.com/sumitkolhe/jiosaavn-api).
 *
 * Public instances come and go. Put your own deployment first (or alone) with
 *   EXPO_PUBLIC_SAAVN_API_HOSTS=https://my-saavn.vercel.app,https://saavn.sumit.co
 * Every host is tried in order with automatic failover.
 */
const DEFAULT_HOSTS = ['https://saavn.sumit.co'];

export const SAAVN_HOSTS = (process.env.EXPO_PUBLIC_SAAVN_API_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim().replace(/\/+$/, ''))
  .filter(Boolean)
  .concat(DEFAULT_HOSTS)
  .filter((h, i, all) => all.indexOf(h) === i);

async function get<T>(path: string): Promise<T> {
  const json = await requestJson<{ success: boolean; data: T }>(SAAVN_HOSTS, path, {
    validate: (j) => j?.success === true && j.data != null,
  });
  return json.data;
}

const q = encodeURIComponent;
const tracks = (list: any): Track[] => compact(Array.isArray(list) ? list.map(normalizeSaavnTrack) : []);
const albums = (list: any): AlbumSummary[] => compact(Array.isArray(list) ? list.map(normalizeAlbum) : []);
const artists = (list: any): ArtistSummary[] => compact(Array.isArray(list) ? list.map(normalizeArtist) : []);
const playlists = (list: any): PlaylistSummary[] =>
  compact(Array.isArray(list) ? list.map(normalizePlaylist) : []);

export const saavn = {
  async searchSongs(query: string, page = 0, limit = 20): Promise<{ total: number; results: Track[] }> {
    const d = await get<any>(`/api/search/songs?query=${q(query)}&page=${page}&limit=${limit}`);
    return { total: Number(d.total) || 0, results: tracks(d.results) };
  },

  async searchAlbums(query: string, limit = 15): Promise<AlbumSummary[]> {
    const d = await get<any>(`/api/search/albums?query=${q(query)}&limit=${limit}`);
    return albums(d.results);
  },

  async searchArtists(query: string, limit = 15): Promise<ArtistSummary[]> {
    const d = await get<any>(`/api/search/artists?query=${q(query)}&limit=${limit}`);
    return artists(d.results);
  },

  async searchPlaylists(query: string, limit = 15): Promise<PlaylistSummary[]> {
    const d = await get<any>(`/api/search/playlists?query=${q(query)}&limit=${limit}`);
    return playlists(d.results);
  },

  /**
   * The combined `/api/search` endpoint returns light items (field `title`, no
   * stream URLs), so songs from it cannot be played. Use the dedicated
   * endpoints instead and tolerate one of them failing.
   */
  async searchAll(query: string): Promise<SearchAllResult> {
    const settled = await Promise.allSettled([
      saavn.searchSongs(query, 0, 20),
      saavn.searchAlbums(query, 10),
      saavn.searchArtists(query, 10),
      saavn.searchPlaylists(query, 10),
    ]);
    if (settled.every((r) => r.status === 'rejected')) throw (settled[0] as PromiseRejectedResult).reason;
    const value = <T,>(r: PromiseSettledResult<T>, empty: T): T => (r.status === 'fulfilled' ? r.value : empty);
    return {
      songs: value(settled[0], { total: 0, results: [] as Track[] }).results,
      albums: value(settled[1], [] as AlbumSummary[]),
      artists: value(settled[2], [] as ArtistSummary[]),
      playlists: value(settled[3], [] as PlaylistSummary[]),
    };
  },

  async song(id: string): Promise<Track | null> {
    const d = await get<any>(`/api/songs/${q(id)}`);
    return tracks(Array.isArray(d) ? d : [d])[0] ?? null;
  },

  async suggestions(id: string, limit = 20): Promise<Track[]> {
    const d = await get<any>(`/api/songs/${q(id)}/suggestions?limit=${limit}`);
    return tracks(Array.isArray(d) ? d : d.results);
  },

  async album(id: string): Promise<AlbumDetail> {
    const d = await get<any>(`/api/albums?id=${q(id)}`);
    const base = normalizeAlbum(d);
    if (!base) throw new Error('Album not found');
    return { ...base, description: d.description ? decodeEntities(d.description) : undefined, songs: tracks(d.songs) };
  },

  async playlist(id: string, limit = 100): Promise<PlaylistDetail> {
    const d = await get<any>(`/api/playlists?id=${q(id)}&limit=${limit}`);
    const base = normalizePlaylist(d);
    if (!base) throw new Error('Playlist not found');
    return { ...base, songs: tracks(d.songs) };
  },

  async artist(id: string): Promise<ArtistDetail> {
    const d = await get<any>(`/api/artists/${q(id)}?songCount=20&albumCount=12`);
    const base = normalizeArtist(d);
    if (!base) throw new Error('Artist not found');
    const bio = Array.isArray(d.bio)
      ? d.bio.map((b: any) => decodeEntities(b?.text)).filter(Boolean).join('\n\n')
      : typeof d.bio === 'string'
        ? decodeEntities(d.bio)
        : undefined;
    return {
      ...base,
      bio: bio || undefined,
      isVerified: d.isVerified === true,
      topSongs: tracks(d.topSongs),
      topAlbums: albums(d.topAlbums),
      singles: albums(d.singles),
      similar: artists(d.similarArtists),
    };
  },

  async artistSongs(id: string, page = 0): Promise<Track[]> {
    const d = await get<any>(`/api/artists/${q(id)}/songs?page=${page}&sortBy=popularity&sortOrder=desc`);
    return tracks(d.songs);
  },
};
