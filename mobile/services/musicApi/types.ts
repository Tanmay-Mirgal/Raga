export type Source = 'saavn' | 'audius';

export interface ImageRef {
  quality?: string;
  url: string;
}

export interface ArtistRef {
  id?: string;
  name: string;
  image?: ImageRef[];
  role?: string;
}

export interface StreamUrl {
  url: string;
  quality: string;
}

/**
 * Canonical track shape used everywhere in the app. It is a superset of the
 * JioSaavn shape the server already stores for likes/playlists, so existing
 * saved data keeps working. `duration` is in SECONDS.
 */
export interface Track {
  id: string;
  name: string;
  artists: { primary: ArtistRef[] };
  image: ImageRef[];
  downloadUrl: StreamUrl[];
  duration?: number;
  album?: { id?: string; name: string };
  year?: string;
  language?: string;
  hasLyrics?: boolean;
  explicit?: boolean;
  source?: Source;
  localUri?: string;
}

export interface AlbumSummary {
  id: string;
  name: string;
  artists: ArtistRef[];
  image: ImageRef[];
  year?: string;
  songCount?: number;
}

export interface ArtistSummary {
  id: string;
  name: string;
  image: ImageRef[];
  role?: string;
  followerCount?: number;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  image: ImageRef[];
  songCount?: number;
  description?: string;
}

export interface AlbumDetail extends AlbumSummary {
  description?: string;
  songs: Track[];
}

export interface ArtistDetail extends ArtistSummary {
  bio?: string;
  isVerified?: boolean;
  topSongs: Track[];
  topAlbums: AlbumSummary[];
  singles: AlbumSummary[];
  similar: ArtistSummary[];
}

export interface PlaylistDetail extends PlaylistSummary {
  songs: Track[];
}

export interface SearchAllResult {
  songs: Track[];
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  playlists: PlaylistSummary[];
}

export type HomeSection =
  | { id: string; title: string; type: 'songs'; items: Track[] }
  | { id: string; title: string; type: 'albums'; items: AlbumSummary[] }
  | { id: string; title: string; type: 'artists'; items: ArtistSummary[] }
  | { id: string; title: string; type: 'playlists'; items: PlaylistSummary[] };

export type ImageSize = 'sm' | 'md' | 'lg';

/** Pick an artwork URL for a given size; Saavn returns 50 / 150 / 500px variants. */
export function pickImage(images: ImageRef[] | undefined, size: ImageSize = 'md'): string | undefined {
  if (!images || images.length === 0) return undefined;
  if (size === 'sm') return images[0]?.url;
  if (size === 'lg') return images[images.length - 1]?.url;
  return (images[1] ?? images[0])?.url;
}

export function primaryArtistName(track: Pick<Track, 'artists'> | null | undefined): string {
  return track?.artists?.primary?.[0]?.name || 'Unknown Artist';
}

export function allArtistNames(track: Pick<Track, 'artists'> | null | undefined): string {
  const names = (track?.artists?.primary ?? []).map((a) => a.name).filter(Boolean);
  return names.length ? names.slice(0, 3).join(', ') : 'Unknown Artist';
}
