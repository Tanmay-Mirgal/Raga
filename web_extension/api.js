/**
 * Raga Browser Extension - API Helper
 * Communicates with JioSaavn API mirrors and the Raga Node.js backend.
 */

const SAAVN_HOSTS = [
  'https://saavn.sumit.co',
  'https://saavn.dev'
];

const RAGA_BACKEND = 'https://raga-music-player-node.onrender.com';

function decodeHtml(html) {
  if (!html) return '';
  if (typeof document !== 'undefined' && document.createElement) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }
  // Safe fallback for Service Worker / background context
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Normalizes raw Saavn API song data to standard Raga track format
 */
export function normalizeTrack(song) {
  if (!song) return null;

  // Title
  let name = song.name || song.title || 'Unknown Song';
  try {
    name = decodeHtml(name);
  } catch (e) {}

  // Artist
  let artist = 'Unknown Artist';
  if (Array.isArray(song.artists?.primary) && song.artists.primary.length > 0) {
    artist = song.artists.primary.map(a => a.name).join(', ');
  } else if (typeof song.primaryArtists === 'string' && song.primaryArtists) {
    artist = song.primaryArtists;
  } else if (song.artist) {
    artist = song.artist;
  }
  try {
    artist = decodeHtml(artist);
  } catch (e) {}

  // Album
  let album = '';
  if (song.album?.name) album = song.album.name;
  else if (typeof song.album === 'string') album = song.album;

  // Image artwork (prefer highest quality 500x500, then mid, then low)
  let imageUrl = '';
  if (Array.isArray(song.image) && song.image.length > 0) {
    imageUrl = song.image[2]?.url || song.image[1]?.url || song.image[0]?.url || '';
  } else if (typeof song.image === 'string') {
    imageUrl = song.image;
  } else if (song.imageUrl) {
    imageUrl = song.imageUrl;
  }

  // Audio Stream URL (prefer 320kbps, then 160kbps, then 96kbps)
  let streamUrl = '';
  if (Array.isArray(song.downloadUrl) && song.downloadUrl.length > 0) {
    const q320 = song.downloadUrl.find(u => u.quality === '320kbps');
    const q160 = song.downloadUrl.find(u => u.quality === '160kbps');
    const q96 = song.downloadUrl.find(u => u.quality === '96kbps');
    streamUrl = q320?.url || q160?.url || q96?.url || song.downloadUrl[song.downloadUrl.length - 1]?.url || '';
  } else if (typeof song.media_url === 'string') {
    streamUrl = song.media_url;
  } else if (typeof song.streamUrl === 'string') {
    streamUrl = song.streamUrl;
  }

  const duration = parseInt(song.duration, 10) || 0;

  return {
    id: String(song.id),
    name,
    artist,
    album,
    imageUrl: imageUrl.replace('http:', 'https:'),
    streamUrl: streamUrl.replace('http:', 'https:'),
    duration,
    raw: song
  };
}

/**
 * Make API request with multi-host automatic failover
 */
async function fetchWithFailover(path) {
  let lastError = null;
  for (const host of SAAVN_HOSTS) {
    try {
      const url = `${host}${path}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && (data.success === true || data.status === 'SUCCESS' || Array.isArray(data.data) || data.data?.results)) {
        return data;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Failed to fetch from all API mirrors: ${path}`);
}

/**
 * Search songs by query string
 */
export async function searchSongs(query, limit = 20) {
  if (!query || !query.trim()) return [];
  try {
    const encoded = encodeURIComponent(query.trim());
    const data = await fetchWithFailover(`/api/search/songs?query=${encoded}&limit=${limit}`);
    const rawList = data?.data?.results || (Array.isArray(data?.data) ? data.data : []);
    return rawList.map(normalizeTrack).filter(t => t && t.streamUrl);
  } catch (err) {
    console.warn('[Raga API] searchSongs error:', err);
    return [];
  }
}

/**
 * Fetch lyrics from lrclib (matching Raga Web)
 */
export async function fetchLyrics(trackName, artistName) {
  try {
    const query = `${trackName} ${artistName}`.trim();
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return data[0]?.syncedLyrics || data[0]?.plainLyrics || null;
  } catch (e) {
    return null;
  }
}

/**
 * Get recommended or song suggestions by song ID
 */
export async function getSuggestions(songId, limit = 15) {
  if (!songId) return [];
  try {
    const data = await fetchWithFailover(`/api/songs/${encodeURIComponent(songId)}/suggestions?limit=${limit}`);
    const rawList = Array.isArray(data?.data) ? data.data : (data?.data?.results || []);
    return rawList.map(normalizeTrack).filter(t => t && t.streamUrl);
  } catch (err) {
    console.warn('[Raga API] getSuggestions error:', err);
    return [];
  }
}

/**
 * Get trending songs / top chart starter picks
 */
export async function getTrendingSongs() {
  const defaultQueries = ['Arijit Singh', 'Trending Hindi Hits', 'Sidhu Moosewala', 'Top Punjabi', 'Global Hits'];
  const randomQuery = defaultQueries[Math.floor(Math.random() * defaultQueries.length)];
  return await searchSongs(randomQuery, 15);
}

/**
 * Storage Helpers for Recently Played Tracks (used where chrome.storage is available)
 */
export async function getRecentlyPlayed() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve([]);
      return;
    }
    chrome.storage.local.get(['recentlyPlayed', 'userId'], async (result) => {
      let list = result?.recentlyPlayed || [];
      // Optionally sync from backend if userId configured
      if (result?.userId && list.length === 0) {
        try {
          const res = await fetch(`${RAGA_BACKEND}/api/interactions/recent?userId=${encodeURIComponent(result.userId)}&limit=15`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              list = data.map(normalizeTrack).filter(Boolean);
              chrome.storage.local.set({ recentlyPlayed: list });
            }
          }
        } catch (e) {}
      }
      resolve(list);
    });
  });
}

/**
 * Saves a track to recently played history in local storage and records backend interaction
 */
export async function recordTrackPlay(track) {
  if (!track || !track.id) return;
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  chrome.storage.local.get(['recentlyPlayed', 'userId'], async (res) => {
    let list = res?.recentlyPlayed || [];
    // Remove if already exists so it gets bumped to top
    list = list.filter(t => t.id !== track.id);
    list.unshift(track);
    // Keep max 30 tracks
    if (list.length > 30) list = list.slice(0, 30);

    chrome.storage.local.set({ recentlyPlayed: list });

    // Optional: Log to Raga server if userId exists
    if (res?.userId) {
      try {
        await fetch(`${RAGA_BACKEND}/api/interactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: res.userId,
            track: track.raw || track,
            interactionType: 'play'
          })
        });
      } catch (e) {
        // Non-blocking log failure
      }
    }
  });
}
