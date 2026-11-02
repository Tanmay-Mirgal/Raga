import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useAudio } from '../../../context/AudioContext';
import TrackMenuModal from '../../../components/TrackMenuModal';
import { MemoizedTrackRow } from '../../../components/MemoizedTrackRow';
import { CoverCard } from '../../../components/CoverCard';
import { useRouter } from 'expo-router';
import {
  searchAll,
  pickImage,
  allArtistNames,
  type AlbumSummary,
  type ArtistSummary,
  type PlaylistSummary,
  type Track,
} from '../../../services/musicApi';
import { getPlayableOfflineTracks } from '../../../utils/offline';
import { getNetState } from '../../../utils/network';
import { getSettings } from '../../../utils/settings';

const { width } = Dimensions.get('window');

const MAX_RECENT = 10;
let memoryRecentSearches: any[] = [];

const loadRecentSearches = async (): Promise<any[]> => {
  if (Platform.OS === 'web') {
    try {
      const raw = window.localStorage.getItem('raga_recent_searches');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  const dir = FileSystem.documentDirectory;
  if (!dir) return memoryRecentSearches;

  try {
    const file = `${dir}raga_recent_searches.json`;
    const info = await FileSystem.getInfoAsync(file);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(file);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveRecentSearches = async (items: any[]) => {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem('raga_recent_searches', JSON.stringify(items));
    } catch {}
    return;
  }

  const dir = FileSystem.documentDirectory;
  if (!dir) {
    memoryRecentSearches = items;
    return;
  }

  try {
    const file = `${dir}raga_recent_searches.json`;
    await FileSystem.writeAsStringAsync(file, JSON.stringify(items));
  } catch {}
};

const addRecentTrack = async (track: any): Promise<any[]> => {
  if (!track || !track.id) return [];
  const current = await loadRecentSearches();
  // Move to front, deduplicate by ID, cap at MAX_RECENT
  const updated = [track, ...current.filter((t) => t.id !== track.id)].slice(0, MAX_RECENT);
  await saveRecentSearches(updated);
  return updated;
};

// ─── Browse Categories ────────────────────────────────────────────────────────

interface BrowseCategory {
  id: string;
  title: string;
  query: string;
  color: string;
}

const CATEGORIES: BrowseCategory[] = [
  { id: '1', title: 'Romance',                query: 'romantic hindi',   color: '#E61E32' },
  { id: '2', title: 'Punjabi',                query: 'punjabi pop',      color: '#B026FF' },
  { id: '3', title: 'Bollywood Hits',         query: 'bollywood hits',   color: '#E8115B' },
  { id: '4', title: 'Lofi & Chill',           query: 'lofi chill',       color: '#1E3264' },
  { id: '5', title: 'Workout',                query: 'gym workout',      color: '#FF6437' },
  { id: '6', title: 'Hip-Hop',                query: 'desi hip hop',     color: '#BC438B' },
  { id: '7', title: 'Party Mood',             query: 'party hits',       color: '#31B057' },
  { id: '8', title: 'Relaxing Instrumentals', query: 'acoustic guitar',  color: '#FFC862' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const { playTrack, currentTrack, isPlaying } = useAudio();

  const [searchQuery, setSearchQuery]   = useState('');
  const [loading, setLoading]           = useState(false);
  const router = useRouter();
  const [results, setResults]           = useState<any[]>([]);
  const [albums, setAlbums]             = useState<AlbumSummary[]>([]);
  const [artists, setArtists]           = useState<ArtistSummary[]>([]);
  const [playlistResults, setPlaylistResults] = useState<PlaylistSummary[]>([]);
  const [searchFailed, setSearchFailed] = useState(false);
  const [localOnly, setLocalOnly]       = useState(false);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [isFocused, setIsFocused]       = useState(false);

  // Track Options Menu
  const [isTrackMenuVisible, setIsTrackMenuVisible] = useState(false);
  const [menuTrack, setMenuTrack]       = useState<any>(null);

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches().then(setRecentSearches);
  }, []);

  // ── Search logic with debounce ─────────────────────────────────────────────
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setAlbums([]);
      setArtists([]);
      setPlaylistResults([]);
      setSearchFailed(false);
      setLocalOnly(false);
      return;
    }

    // Songs saved on this device are always searchable, even with no internet.
    const needle = query.trim().toLowerCase();
    const searchSaved = (): Track[] =>
      getPlayableOfflineTracks().filter(
        (t) => t.name.toLowerCase().includes(needle) || allArtistNames(t).toLowerCase().includes(needle)
      );

    if (!getNetState().online || getSettings().offlineMode) {
      setResults(searchSaved());
      setAlbums([]);
      setArtists([]);
      setPlaylistResults([]);
      setLocalOnly(true);
      setSearchFailed(false);
      return;
    }

    try {
      setLoading(true);
      setLocalOnly(false);
      setSearchFailed(false);
      const found = await searchAll(query);
      setResults(found.songs);
      setAlbums(found.albums);
      setArtists(found.artists);
      setPlaylistResults(found.playlists);
    } catch (e) {
      console.log('Search unavailable:', (e as Error)?.message);
      const saved = searchSaved();
      setResults(saved);
      setAlbums([]);
      setArtists([]);
      setPlaylistResults([]);
      setLocalOnly(saved.length > 0);
      setSearchFailed(saved.length === 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), 450);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Tap a recent track ─────────────────────────────────────────────────────
  const handleSelectRecent = (track: any) => {
    playTrack(track, recentSearches);
  };

  // ── Remove one recent track ─────────────────────────────────────────────────
  const handleRemoveRecent = async (track: any) => {
    const updated = recentSearches.filter((t) => t.id !== track.id);
    setRecentSearches(updated);
    await saveRecentSearches(updated);
  };

  // ── Clear all recent searches ──────────────────────────────────────────────
  const handleClearAll = async () => {
    setRecentSearches([]);
    await saveRecentSearches([]);
  };

  // ── Category tap ──────────────────────────────────────────────────────────
  const handleSelectCategory = (cat: BrowseCategory) => {
    setSearchQuery(cat.query);
  };

  // ── Play a song from results ───────────────────────────────────────────────
  const handlePlaySong = async (song: any) => {
    const updated = await addRecentTrack(song);
    setRecentSearches(updated);
    playTrack(song, results);
  };

  // ── Open 3-dot menu ───────────────────────────────────────────────────────
  const handleOpenMenu = (song: any) => {
    setMenuTrack(song);
    setIsTrackMenuVisible(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const showRecent = searchQuery.length === 0 && isFocused && recentSearches.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.screenHeader}>Search</Text>

      {/* Search bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={20} color="#A7A7B3" style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="What do you want to listen to?"
          placeholderTextColor="#535353"
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={20} color="#A7A7B3" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── State: Loading ── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Searching sound waves...</Text>
        </View>

      ) : searchQuery.length > 0 ? (
        /* ── State: Results ── */
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              {localOnly && (
                <Text style={{ color: '#B3B3B3', fontSize: 12, marginBottom: 12 }}>
                  Offline · showing songs saved on your device
                </Text>
              )}
              {artists.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.sectionHeader}>Artists</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {artists.map((a) => (
                      <CoverCard key={a.id} round size={110} title={a.name} subtitle="Artist" imageUrl={pickImage(a.image, 'md')} onPress={() => router.push(`/artist/${a.id}?name=${encodeURIComponent(a.name)}` as any)} />
                    ))}
                  </ScrollView>
                </View>
              )}
              {albums.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.sectionHeader}>Albums</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {albums.map((a) => (
                      <CoverCard key={a.id} size={120} title={a.name} subtitle={a.year} imageUrl={pickImage(a.image, 'lg')} onPress={() => router.push(`/album/${a.id}` as any)} />
                    ))}
                  </ScrollView>
                </View>
              )}
              {playlistResults.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.sectionHeader}>Playlists</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {playlistResults.map((p) => (
                      <CoverCard key={p.id} size={120} title={p.name} subtitle={p.songCount ? `${p.songCount} songs` : 'Playlist'} imageUrl={pickImage(p.image, 'lg')} onPress={() => router.push(`/playlist/${p.id}` as any)} />
                    ))}
                  </ScrollView>
                </View>
              )}
              {results.length > 0 && <Text style={styles.sectionHeader}>Songs</Text>}
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130 }}
          // ── Chunking / performance props ──────────────────────────────────
          initialNumToRender={8}        // first visible chunk
          maxToRenderPerBatch={5}       // items added per scroll tick
          windowSize={5}               // keep 5 screens worth in memory
          removeClippedSubviews={true} // unmount items far off-screen
          updateCellsBatchingPeriod={30}
          renderItem={({ item }) => {
            const isCurrent = currentTrack?.id === item.id;
            return (
              <MemoizedTrackRow
                id={item.id}
                name={item.name}
                artist={item.artists?.primary?.[0]?.name || 'Unknown Artist'}
                imageUrl={item.image?.[1]?.url || item.image?.[0]?.url}
                isCurrent={isCurrent}
                isPlaying={isPlaying}
                onPress={() => handlePlaySong(item)}
                onMenuPress={() => handleOpenMenu(item)}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchFailed ? "Can't search right now. Check your connection." : `No results for "${searchQuery}"`}
              </Text>
            </View>
          }
        />

      ) : (
        /* ── State: Empty query — show recent OR categories ── */
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {showRecent ? (
            /* Show History ONLY when input is focused */
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.sectionHeader}>Recently played</Text>
                <TouchableOpacity onPress={handleClearAll}>
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              </View>

              {recentSearches.map((track) => (
                <MemoizedTrackRow
                  key={track.id}
                  id={track.id}
                  name={track.name}
                  artist={track.artists?.primary?.[0]?.name || 'Unknown Artist'}
                  imageUrl={track.image?.[1]?.url || track.image?.[0]?.url}
                  isCurrent={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  onPress={() => handleSelectRecent(track)}
                  onMenuPress={() => {}}
                  onRemove={() => handleRemoveRecent(track)}
                />
              ))}
            </View>
          ) : (
            /* Show Categories ONLY when input is blurred/unfocused */
            <View>
              <Text style={styles.sectionHeader}>Browse all</Text>
              <View style={styles.gridContainer}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryCard, { backgroundColor: cat.color }]}
                    onPress={() => handleSelectCategory(cat)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.categoryTitle}>{cat.title}</Text>
                    <View style={styles.cardGraphic}>
                      <Ionicons name="disc" size={48} color="rgba(255,255,255,0.18)" style={styles.graphicRotated} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Track Options Modal */}
      <TrackMenuModal
        visible={isTrackMenuVisible}
        track={menuTrack}
        onClose={() => setIsTrackMenuVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingTop: 54,
  },
  screenHeader: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    paddingHorizontal: 16,
    marginBottom: 16,
  },

  // Search bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C26',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    height: 50,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  searchIcon:  { marginRight: 10 },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
  },
  clearBtn: { padding: 4 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#B3B3B3', fontSize: 14, marginTop: 10 },

  // Section header
  sectionHeader: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 14,
  },

  // Recent searches
  recentSection: { marginBottom: 28 },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clearAllText: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  recentLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  recentText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  recentRemoveBtn: {
    paddingLeft: 12,
  },

  // Categories grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryCard: {
    width: (width - 44) / 2,
    height: 96,
    borderRadius: 4,
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  categoryTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    width: '80%',
  },
  cardGraphic:   { position: 'absolute', bottom: -10, right: -10 },
  graphicRotated: { transform: [{ rotate: '25deg' }] },

  // Search results
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  activeResultRow: { backgroundColor: 'rgba(29, 185, 84, 0.05)' },
  resultImage: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#282828',
  },
  resultDetails: { flex: 1, marginLeft: 14, paddingRight: 10 },
  resultTrackName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  activeText:      { color: '#1DB954' },
  resultArtistName:{ color: '#B3B3B3', fontSize: 12 },
  menuBtn:         { padding: 12 },

  // Empty
  emptyContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyText:      { color: '#B3B3B3', fontSize: 14 },
});
