import { audius } from './audius';
import { cached, peek, TTL } from './cache';
import { saavn } from './saavn';
import type {
  AlbumDetail,
  ArtistDetail,
  HomeSection,
  PlaylistDetail,
  SearchAllResult,
  Track,
} from './types';

export * from './types';
export { clearApiCache } from './cache';
export { SAAVN_HOSTS } from './saavn';

/**
 * Public music API. Every call is cached (stale-if-error), and song queries
 * fail over from the JioSaavn wrapper to Audius when the wrapper is down.
 */

const norm = (s: string) => s.trim().toLowerCase();
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type StreamQuality = 'low' | 'normal' | 'high';
const TARGET_KBPS: Record<StreamQuality, number> = { low: 96, normal: 160, high: 320 };

/** Choose the stream whose bitrate is closest to the requested quality. */
export function pickStreamUrl(track: Track, quality: StreamQuality = 'high'): string | undefined {
  const list = track.downloadUrl ?? [];
  if (list.length === 0) return undefined;
  const target = TARGET_KBPS[quality];
  let best = list[0];
  let bestDiff = Infinity;
  for (const s of list) {
    const kbps = parseInt(s.quality, 10) || 0;
    const diff = Math.abs(kbps - target);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best.url;
}

export async function searchSongs(query: string, page = 0, limit = 20): Promise<Track[]> {
  const key = `songs:${norm(query)}:${page}:${limit}`;
  return cached(key, TTL.search, async () => {
    try {
      return (await saavn.searchSongs(query, page, limit)).results;
    } catch (primaryError) {
      try {
        return page === 0 ? await audius.searchSongs(query, limit) : [];
      } catch {
        throw primaryError;
      }
    }
  });
}

export async function searchAll(query: string): Promise<SearchAllResult> {
  return cached(`all:${norm(query)}`, TTL.search, async () => {
    try {
      return await saavn.searchAll(query);
    } catch (primaryError) {
      try {
        return { songs: await audius.searchSongs(query, 20), albums: [], artists: [], playlists: [] };
      } catch {
        throw primaryError;
      }
    }
  });
}

export const getAlbum = (id: string): Promise<AlbumDetail> =>
  cached(`album:${id}`, TTL.detail, () => saavn.album(id));

export const getPlaylist = (id: string): Promise<PlaylistDetail> =>
  cached(`playlist:${id}`, TTL.detail, () => saavn.playlist(id));

/**
 * Some artist pages are broken upstream (the wrapper returns HTTP 500 for them),
 * so when a name is known we rebuild a useful page from search instead.
 */
export async function getArtist(id: string, nameHint?: string): Promise<ArtistDetail> {
  try {
    return await cached(`artist:${id}`, TTL.detail, () => saavn.artist(id));
  } catch (error) {
    if (!nameHint) throw error;
    return cached(`artist-lite:${id}`, TTL.search, async () => {
      const [songs, albums] = await Promise.all([
        saavn.searchSongs(nameHint, 0, 25).then((r) => r.results),
        saavn.searchAlbums(nameHint, 12),
      ]);
      const own = songs.filter((s) => s.artists.primary.some((a) => a.id === id || a.name === nameHint));
      const portrait = songs.flatMap((s) => s.artists.primary).find((a) => a.id === id)?.image ?? [];
      return {
        id,
        name: nameHint,
        image: portrait,
        topSongs: own.length > 0 ? own : songs,
        topAlbums: albums,
        singles: [],
        similar: [],
      };
    });
  }
}

export const getArtistSongs = (id: string, page = 0): Promise<Track[]> =>
  cached(`artist-songs:${id}:${page}`, TTL.detail, () => saavn.artistSongs(id, page));

/** Fresh stream URLs for one track (used when a cached URL stops working). */
export async function refreshTrack(track: Track): Promise<Track | null> {
  if (track.source === 'audius' || track.id.startsWith('audius_')) return track; // audius stream URLs are stable
  try {
    return await saavn.song(track.id);
  } catch {
    return null;
  }
}

/** "Song radio": tracks similar to a seed, used for autoplay and the Radio button. */
export async function getRadio(seed: Track, limit = 20): Promise<Track[]> {
  return cached(`radio:${seed.id}`, TTL.suggestions, async () => {
    if (seed.source !== 'audius') {
      try {
        const list = await saavn.suggestions(seed.id, limit);
        if (list.length > 0) return list;
      } catch {
        // suggestions endpoint is flaky on some hosts; fall through to a search-based radio
      }
    }
    const artist = seed.artists.primary[0]?.name;
    const results = await searchSongs(artist ? `${artist} ${seed.language ?? ''}`.trim() : seed.name, 0, limit);
    return results.filter((t) => t.id !== seed.id);
  });
}

const TOP_ARTIST_SEEDS: Record<string, string[]> = {
  hindi: ['Arijit Singh', 'Shreya Ghoshal', 'Atif Aslam', 'Neha Kakkar', 'Jubin Nautiyal', 'Badshah', 'Sonu Nigam', 'Pritam'],
  english: ['Taylor Swift', 'Ed Sheeran', 'The Weeknd', 'Dua Lipa', 'Billie Eilish', 'Justin Bieber', 'Coldplay', 'Imagine Dragons'],
  punjabi: ['Diljit Dosanjh', 'AP Dhillon', 'Sidhu Moose Wala', 'Karan Aujla', 'Guru Randhawa', 'Jassie Gill', 'Ammy Virk', 'B Praak'],
  telugu: ['Anirudh Ravichander', 'Sid Sriram', 'Devi Sri Prasad', 'S Thaman', 'Armaan Malik', 'Chinmayi', 'Mangli', 'Yazin Nizar'],
  tamil: ['Anirudh Ravichander', 'A. R. Rahman', 'Yuvan Shankar Raja', 'Sid Sriram', 'Harris Jayaraj', 'Dhee', 'Shreya Ghoshal', 'Hiphop Tamizha'],
  marathi: ['Ajay-Atul', 'Shankar Mahadevan', 'Avadhoot Gupte', 'Adarsh Shinde', 'Vaishali Made', 'Sonu Nigam', 'Shreya Ghoshal', 'Swapnil Bandodkar'],
};

async function topArtists(language: string) {
  const seeds = TOP_ARTIST_SEEDS[language] ?? TOP_ARTIST_SEEDS.hindi;
  const found = await Promise.all(
    seeds.map((name) =>
      cached(`artist-seed:${norm(name)}`, TTL.detail, () => saavn.searchArtists(name, 1)).then(
        (r) => r[0],
        () => undefined
      )
    )
  );
  return found.filter((a): a is NonNullable<typeof a> => !!a);
}

/**
 * Spotify-style home: several independent shelves. A shelf that fails is
 * dropped (or served from cache); we only throw if nothing at all loads.
 */
export async function getHomeSections(languages: string[], genres: string[]): Promise<HomeSection[]> {
  const primary = languages[0] || 'hindi';
  const secondary = languages[1] || primary;
  const g1 = genres[0] || 'lofi';
  const g2 = genres[1] || 'romantic';
  const cacheKey = `home:${languages.join(',')}:${genres.join(',')}`;

  return cached(cacheKey, TTL.home, async () => {
    const jobs: Promise<HomeSection | null>[] = [
      searchSongs(`${primary} hits`, 0, 15).then((items) => ({ id: 'trending', title: `Trending ${capitalize(primary)}`, type: 'songs' as const, items })),
      searchSongs(`${primary} new songs`, 0, 15).then((items) => ({ id: 'new', title: 'New releases', type: 'songs' as const, items })),
      saavn.searchAlbums(`${primary} hits`, 12).then((items) => ({ id: 'albums', title: 'Popular albums', type: 'albums' as const, items })),
      topArtists(primary).then((items) => ({ id: 'artists', title: `Top ${capitalize(primary)} artists`, type: 'artists' as const, items })),
      saavn.searchPlaylists(`${primary} ${g1}`, 12).then((items) => ({ id: 'playlists', title: 'Featured playlists', type: 'playlists' as const, items })),
      searchSongs(`${primary} ${g1}`, 0, 15).then((items) => ({ id: `g-${g1}`, title: `${capitalize(primary)} ${capitalize(g1)}`, type: 'songs' as const, items })),
      searchSongs(`${primary} ${g2}`, 0, 15).then((items) => ({ id: `g-${g2}`, title: `${capitalize(primary)} ${capitalize(g2)}`, type: 'songs' as const, items })),
    ];
    if (secondary !== primary) {
      jobs.push(
        searchSongs(`${secondary} ${g1}`, 0, 15).then((items) => ({ id: `s-${secondary}`, title: `${capitalize(secondary)} ${capitalize(g1)}`, type: 'songs' as const, items }))
      );
    }

    const settled = await Promise.allSettled(jobs);
    const sections = settled
      .filter((r): r is PromiseFulfilledResult<HomeSection | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((s): s is HomeSection => !!s && s.items.length > 0);

    if (sections.length === 0) {
      const firstFailure = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      throw firstFailure?.reason ?? new Error('Home feed is empty');
    }
    return sections;
  });
}

/** Last successfully loaded home feed, readable instantly (even offline). */
export const peekHomeSections = (languages: string[], genres: string[]) =>
  peek<HomeSection[]>(`home:${languages.join(',')}:${genres.join(',')}`);
