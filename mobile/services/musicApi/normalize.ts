import type {
  AlbumSummary,
  ArtistRef,
  ArtistSummary,
  ImageRef,
  PlaylistSummary,
  StreamUrl,
  Track,
} from './types';

const ENTITIES: Record<string, string> = {
  '&quot;': '"',
  '&amp;': '&',
  '&#039;': "'",
  '&#39;': "'",
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

/** JioSaavn returns HTML-escaped titles like `Kesariya (From &quot;Brahmastra&quot;)`. */
export function decodeEntities(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/&(quot|amp|#0?39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

const toImages = (raw: any): ImageRef[] =>
  Array.isArray(raw)
    ? raw.filter((i) => i && typeof i.url === 'string').map((i) => ({ quality: i.quality, url: i.url }))
    : [];

const toArtistRef = (a: any): ArtistRef => ({
  id: a?.id != null ? String(a.id) : undefined,
  name: decodeEntities(a?.name),
  image: toImages(a?.image),
  role: a?.role,
});

export function normalizeSaavnTrack(raw: any): Track | null {
  if (!raw || raw.id == null) return null;
  const streams: StreamUrl[] = Array.isArray(raw.downloadUrl)
    ? raw.downloadUrl
        .filter((d: any) => d && typeof d.url === 'string' && d.url)
        .map((d: any) => ({ url: d.url, quality: d.quality }))
    : [];
  const primary: ArtistRef[] = (raw.artists?.primary ?? raw.artists?.all ?? [])
    .map(toArtistRef)
    .filter((a: ArtistRef) => a.name);
  const duration = Number(raw.duration);

  return {
    id: String(raw.id),
    name: decodeEntities(raw.name),
    artists: { primary: primary.length ? primary : [{ name: 'Unknown Artist' }] },
    image: toImages(raw.image),
    downloadUrl: streams,
    duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    album: raw.album?.name
      ? { id: raw.album.id != null ? String(raw.album.id) : undefined, name: decodeEntities(raw.album.name) }
      : undefined,
    year: raw.year ? String(raw.year) : undefined,
    language: raw.language,
    hasLyrics: raw.hasLyrics === true || raw.hasLyrics === 'true',
    explicit: raw.explicitContent === true || raw.explicitContent === 1,
    source: 'saavn',
  };
}

export function normalizeAudiusTrack(raw: any, streamBase: string, appName: string): Track | null {
  if (!raw || raw.id == null) return null;
  if (raw.is_streamable === false || raw.is_stream_gated === true || raw.is_unlisted === true) return null;

  const art = raw.artwork ?? {};
  const image: ImageRef[] = (['150x150', '480x480', '1000x1000'] as const)
    .filter((q) => typeof art[q] === 'string')
    .map((q) => ({ quality: q, url: art[q] as string }));

  const duration = Number(raw.duration);
  return {
    id: `audius_${raw.id}`,
    name: decodeEntities(raw.title),
    artists: { primary: [{ id: raw.user?.id ? `audius_${raw.user.id}` : undefined, name: raw.user?.name || 'Unknown Artist' }] },
    image,
    downloadUrl: [{ quality: '320kbps', url: `${streamBase}/v1/tracks/${raw.id}/stream?app_name=${appName}` }],
    duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    year: raw.release_date ? String(raw.release_date).slice(0, 4) : undefined,
    source: 'audius',
  };
}

export function normalizeAlbum(raw: any): AlbumSummary | null {
  if (!raw || raw.id == null || !decodeEntities(raw.name).trim()) return null;
  const artists = (raw.artists?.primary ?? raw.artists?.all ?? []).map(toArtistRef);
  return {
    id: String(raw.id),
    name: decodeEntities(raw.name),
    artists,
    image: toImages(raw.image),
    year: raw.year ? String(raw.year) : undefined,
    songCount: raw.songCount != null ? Number(raw.songCount) : undefined,
  };
}

export function normalizeArtist(raw: any): ArtistSummary | null {
  // JioSaavn search sometimes returns placeholder profiles with an empty name; they have no usable page.
  if (!raw || raw.id == null || !decodeEntities(raw.name).trim()) return null;
  return {
    id: String(raw.id),
    name: decodeEntities(raw.name),
    image: toImages(raw.image),
    role: raw.role,
    followerCount: raw.followerCount != null ? Number(raw.followerCount) : undefined,
  };
}

export function normalizePlaylist(raw: any): PlaylistSummary | null {
  if (!raw || raw.id == null) return null;
  return {
    id: String(raw.id),
    name: decodeEntities(raw.name),
    image: toImages(raw.image),
    songCount: raw.songCount != null ? Number(raw.songCount) : undefined,
    description: raw.description ? decodeEntities(raw.description) : undefined,
  };
}

export const compact = <T>(list: (T | null | undefined)[]): T[] => list.filter((x): x is T => x != null);
