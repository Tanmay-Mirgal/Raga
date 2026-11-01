import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions, Modal, SafeAreaView, FlatList, Alert } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import React, { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { fetchWithTimeout } from '../../../services/musicApi/http';
import { getHomeSections, peekHomeSections, type HomeSection } from '../../../services/musicApi';
import HomeSections from '../../../components/HomeSections';
import { useAudio } from '../../../context/AudioContext';
import { LinearGradient } from 'expo-linear-gradient';
import TrackMenuModal from '../../../components/TrackMenuModal';
import { MemoizedGridTile } from '../../../components/MemoizedGridTile';
import { MemoizedAlbumCard } from '../../../components/MemoizedAlbumCard';
import { MemoizedTrackRow } from '../../../components/MemoizedTrackRow';

const { width } = Dimensions.get('window');

interface LanguageItem {
  id: string;
  name: string;
  query: string;
  color: string;
}

interface GenreItem {
  id: string;
  name: string;
  query: string;
  color: string;
  icon: string;
}

const LANGUAGE_OPTIONS: LanguageItem[] = [
  { id: 'hin', name: 'Hindi', query: 'hindi', color: '#E61E32' },
  { id: 'eng', name: 'English', query: 'english', color: '#1E3264' },
  { id: 'pun', name: 'Punjabi', query: 'punjabi', color: '#B026FF' },
  { id: 'tel', name: 'Telugu', query: 'telugu', color: '#E8115B' },
  { id: 'tam', name: 'Tamil', query: 'tamil', color: '#31B057' },
  { id: 'mar', name: 'Marathi', query: 'marathi', color: '#FF6437' },
];

const GENRE_OPTIONS: GenreItem[] = [
  { id: 'lofi', name: 'Lofi & Chill', query: 'lofi', color: '#2D46B9', icon: 'leaf-outline' },
  { id: 'romance', name: 'Romantic Vibes', query: 'romantic', color: '#C82A40', icon: 'heart-outline' },
  { id: 'hiphop', name: 'Hip-Hop / Rap', query: 'hip hop', color: '#8C1D6B', icon: 'headset-outline' },
  { id: 'workout', name: 'Workout Power', query: 'workout', color: '#FF7F00', icon: 'barbell-outline' },
  { id: 'party', name: 'Party Hits', query: 'party', color: '#1F9651', icon: 'wine-outline' },
  { id: 'sad', name: 'Sad Songs', query: 'sad', color: '#4A5568', icon: 'rainy-outline' },
];

interface ShelfData {
  title: string;
  songs: any[];
}

// Global session cache for personalized feed
let cachedSections: HomeSection[] = [];
let cachedPlaylists: any[] = [];

export function clearHomeCache() {
  cachedSections = [];
  cachedPlaylists = [];
}

export default function HomeScreen() {
  const { user } = useUser();
  const { playTrack, currentTrack, isPlaying, likedSongs, toggleLikeTrack, downloadedTracks, removeDownload, recentlyPlayed } = useAudio();

  const [loading, setLoading] = useState(true);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Selection states
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Feed states
  const [sections, setSections] = useState<HomeSection[]>(cachedSections);
  const gridSongs = useMemo(() => {
    const first = sections.find((x) => x.type === 'songs');
    return first && first.type === 'songs' ? first.items.slice(0, 6) : [];
  }, [sections]);
  const allSections = useMemo<HomeSection[]>(
    () =>
      recentlyPlayed.length > 0
        ? [{ id: 'recent', title: 'Recently played', type: 'songs', items: recentlyPlayed.slice(0, 15) }, ...sections]
        : sections,
    [sections, recentlyPlayed]
  );
  const [playlists, setPlaylists] = useState<any[]>(cachedPlaylists);

  // States for options modal sheet
  const [isTrackMenuVisible, setIsTrackMenuVisible] = useState(false);
  const [menuTrack, setMenuTrack] = useState<any>(null);

  // Liked Songs details submodal state
  const [isLikedSongsModalVisible, setIsLikedSongsModalVisible] = useState(false);

  // Downloaded Songs details submodal state
  const [isDownloadsModalVisible, setIsDownloadsModalVisible] = useState(false);

  // Smart Mix states
  const [smartMixLoading, setSmartMixLoading] = useState(false);

  const playSmartMix = async () => {
    if (!user) return;
    try {
      setSmartMixLoading(true);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/recommendations?userId=${user.id}`);
      if (res.ok) {
        const recommendedTracks = await res.json();
        if (recommendedTracks && recommendedTracks.length > 0) {
          const formattedTracks = recommendedTracks.map((song: any) => ({
            id: song.id,
            name: song.name,
            artists: {
              primary: song.artists?.primary || [{ name: 'Unknown Artist' }]
            },
            image: song.image || [],
            downloadUrl: song.downloadUrl || []
          }));

          playTrack(formattedTracks[0], formattedTracks);
          Alert.alert('Raga Smart Mix', 'Playing your personalized AI Smart Mix!');
        } else {
          Alert.alert('Smart Mix Empty', 'Add some liked songs to build your mix!');
        }
      } else {
        Alert.alert('Error', 'Failed to generate recommendations.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An error occurred fetching recommendations.');
    } finally {
      setSmartMixLoading(false);
    }
  };

  const displayName = user?.firstName || user?.emailAddresses[0]?.emailAddress.split('@')[0] || 'Listener';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return `Morning, ${displayName}`;
    if (hour < 17) return `Afternoon, ${displayName}`;
    return `Evening, ${displayName}`;
  };

  const syncUserToDatabase = async () => {
    if (!user) return;
    try {
      await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/users/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.imageUrl,
        }),
      });
    } catch (e) {
      console.error('Error syncing user:', e);
    }
  };

  const fetchPlaylists = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
        cachedPlaylists = data;
      }
    } catch (e) {
      console.error('Error fetching playlists:', e);
    }
  };

  const checkPreferencesAndLoad = async () => {
    if (!user) return;

    // Check if cache is already loaded to bypass loading screen
    if (cachedSections.length > 0) {
      setLoading(false);
      fetchPlaylists();
      return;
    }

    try {
      setLoading(true);
      // Do not hold the home screen hostage to a sleeping free-tier server.
      void syncUserToDatabase();
      void fetchPlaylists();

      // Check local storage flag
      const localFlag = await SecureStore.getItemAsync('has_set_preferences');

      const res = await fetchWithTimeout(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/users/preferences?userId=${user.id}`, 8000);
      
      let languages = ['hindi'];
      let genres = ['lofi', 'romantic'];
      let hasPrefs = false;

      if (res.ok) {
        const parsed = await res.json();
        if (parsed.languages && parsed.genres && parsed.languages.length >= 1 && parsed.genres.length >= 2) {
          languages = parsed.languages;
          genres = parsed.genres;
          hasPrefs = true;
          setSelectedLanguages(parsed.languages);
          setSelectedGenres(parsed.genres);
        }
      }

      if (hasPrefs) AsyncStorage.setItem('raga:prefs', JSON.stringify({ languages, genres })).catch(() => {});

      if (hasPrefs || localFlag === 'true') {
        setShowPreferenceModal(false);
        await loadPersonalizedFeed(languages, genres);
        return;
      }
      
      setShowPreferenceModal(true);
      setLoading(false);
    } catch (error) {
      // Offline or server asleep: fall back to the last saved taste profile.
      console.log('Preferences unavailable, using saved ones:', (error as Error)?.message);
      let saved = { languages: ['hindi'], genres: ['lofi', 'romantic'] };
      try {
        const raw = await AsyncStorage.getItem('raga:prefs');
        if (raw) saved = JSON.parse(raw);
      } catch {
        // keep defaults
      }
      await loadPersonalizedFeed(saved.languages, saved.genres);
    }
  };

  useEffect(() => {
    if (user) {
      checkPreferencesAndLoad();
    }
  }, [user]);

  const loadPersonalizedFeed = async (languages: string[], genres: string[]) => {
    try {
      setLoading(true);
      // Show the last feed we loaded straight away (works offline), then refresh it.
      const stored = await peekHomeSections(languages, genres);
      if (stored && stored.length > 0) {
        setSections(stored);
        cachedSections = stored;
        setLoading(false);
      }
      const fresh = await getHomeSections(languages, genres);
      setSections(fresh);
      cachedSections = fresh;
      setShowPreferenceModal(false);
    } catch (e) {
      console.log('Home feed unavailable:', (e as Error)?.message);
    } finally {
      setLoading(false);
    }
  };

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  const toggleLanguageSelection = (query: string) => {
    if (selectedLanguages.includes(query)) {
      setSelectedLanguages(selectedLanguages.filter((l) => l !== query));
    } else {
      setSelectedLanguages([...selectedLanguages, query]);
    }
  };

  const toggleGenreSelection = (query: string) => {
    if (selectedGenres.includes(query)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== query));
    } else {
      setSelectedGenres([...selectedGenres, query]);
    }
  };

  const handleSavePreferences = async () => {
    if (selectedLanguages.length < 1 || selectedGenres.length < 2 || !user) return;
    try {
      setLoading(true);
      const payload = {
        userId: user.id,
        languages: selectedLanguages,
        genres: selectedGenres,
      };
      
      // Save local storage flag
      await SecureStore.setItemAsync('has_set_preferences', 'true');
      AsyncStorage.setItem('raga:prefs', JSON.stringify({ languages: selectedLanguages, genres: selectedGenres })).catch(() => {});

      await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/users/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await loadPersonalizedFeed(selectedLanguages, selectedGenres);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handlePlaySong = (song: any, sectionList: any[]) => {
    playTrack(song, sectionList);
  };

  const handleRemoveDownload = async (trackId: string) => {
    await removeDownload(trackId);
  };

  const handleOpenMenu = (song: any) => {
    setMenuTrack(song);
    setIsTrackMenuVisible(true);
  };

  const getGridItems = () => {
    const items: any[] = [];

    // 1. Liked Songs
    items.push({
      id: 'liked_songs',
      name: 'Liked Songs',
      isCurrent: currentTrack && likedSongs.some((t) => t.id === currentTrack.id),
      onPress: () => {
        setIsLikedSongsModalVisible(true);
      },
    });

    // 2. Downloaded Songs
    items.push({
      id: 'downloaded_songs',
      name: 'Downloaded Songs',
      isCurrent: currentTrack && downloadedTracks.some((t) => t.id === currentTrack.id),
      onPress: () => {
        setIsDownloadsModalVisible(true);
      },
    });

    // 3. Playlists
    playlists.forEach((pl) => {
      if (items.length >= 6) return;
      items.push({
        id: pl.id,
        name: pl.name,
        imageUrl: pl.coverImageUrl || (pl.tracks?.[0]?.image?.[1]?.url || pl.tracks?.[0]?.image?.[0]?.url),
        isCurrent: currentTrack && pl.tracks?.some((t: any) => t.id === currentTrack.id),
        onPress: () => {
          if (pl.tracks && pl.tracks.length > 0) {
            playTrack(pl.tracks[0], pl.tracks);
          } else {
            Alert.alert('Empty Playlist', 'Add some tracks to this playlist first.');
          }
        },
      });
    });

    // 4. Fallback Songs (padding)
    gridSongs.forEach((song) => {
      if (items.length >= 6) return;
      const songImg = song.image?.[1]?.url || song.image?.[0]?.url;
      items.push({
        id: song.id,
        name: song.name,
        imageUrl: songImg,
        isCurrent: currentTrack?.id === song.id,
        onPress: () => handlePlaySong(song, gridSongs),
      });
    });

    return items.slice(0, 6);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={styles.loadingText}>Loading your custom soundscape...</Text>
      </View>
    );
  }

  const gridItems = getGridItems();

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header Row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={require('../../../assets/images/riffy_logo.png')} style={styles.logoImage} />
            <Text style={styles.greetingText}>{getGreeting()}</Text>
          </View>
          <View style={styles.headerRight}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.profileHeaderImage} />
            ) : (
              <Ionicons name="person-circle-outline" size={32} color="#FFFFFF" />
            )}
          </View>
        </View>

        {/* AI Smart Mix Banner */}
        <TouchableOpacity
          style={styles.smartMixBanner}
          onPress={playSmartMix}
          disabled={smartMixLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#1DB954', '#191414']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.smartMixGradient}
          >
            <View style={styles.smartMixContent}>
              <View style={styles.smartMixLeft}>
                <Ionicons name="sparkles" size={24} color="#FFFFFF" style={styles.smartMixIcon} />
                <View>
                  <Text style={styles.smartMixTitle}>Raga AI Smart Mix</Text>
                  <Text style={styles.smartMixSubtitle}>Personalized recommendations based on your taste</Text>
                </View>
              </View>
              {smartMixLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="play-circle" size={32} color="#FFFFFF" />
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Dynamic Quick Play Grid */}
        {gridItems.length > 0 && (
          <View style={styles.gridContainer}>
            {gridItems.map((item) => (
              <MemoizedGridTile
                key={item.id}
                id={item.id}
                name={item.name}
                imageUrl={item.imageUrl}
                isCurrent={!!item.isCurrent}
                onPress={item.onPress}
                onMenuPress={item.id !== 'liked_songs' && !playlists.some(p => p.id === item.id) ? () => handleOpenMenu(item) : undefined}
              />
            ))}
          </View>
        )}

        {/* Personalized shelves: songs, albums, artists, playlists */}
        <HomeSections sections={allSections} onPlaySong={handlePlaySong} onSongMenu={handleOpenMenu} />

        {allSections.length === 0 && (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Ionicons name="cloud-offline-outline" size={40} color="#535353" />
            <Text style={{ color: '#B3B3B3', marginTop: 12, textAlign: 'center' }}>
              Could not load music right now. Your downloads and recently played songs still work.
            </Text>
            <TouchableOpacity
              onPress={checkPreferencesAndLoad}
              style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1DB954' }}
            >
              <Text style={{ color: '#000', fontWeight: 'bold' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 2-Step Preference Modal */}
      <Modal
        visible={showPreferenceModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
      >
        <View style={styles.modalBg}>
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeaderContainer}>
              <View style={styles.modalTopRow}>
                {currentStep === 2 && (
                  <TouchableOpacity onPress={() => setCurrentStep(1)} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                <Text style={styles.stepTitle}>
                  Step {currentStep} of 2
                </Text>
                <View style={{ width: 24 }} />
              </View>
              <Text style={styles.modalTitle}>
                {currentStep === 1 ? 'Select Languages' : 'Choose your vibes'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {currentStep === 1 
                  ? 'Which languages do you listen to? (Select at least 1)'
                  : 'Select at least 2 genres/moods to personalize your feed.'}
              </Text>
            </View>

            {currentStep === 1 ? (
              <ScrollView contentContainerStyle={styles.preferenceGrid} showsVerticalScrollIndicator={false}>
                {LANGUAGE_OPTIONS.map((item) => {
                  const isSelected = selectedLanguages.includes(item.query);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.preferenceCard,
                        { backgroundColor: item.color },
                        isSelected && styles.preferenceCardSelected,
                      ]}
                      onPress={() => toggleLanguageSelection(item.query)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.preferenceName}>{item.name}</Text>
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#1DB954" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <ScrollView contentContainerStyle={styles.preferenceGrid} showsVerticalScrollIndicator={false}>
                {GENRE_OPTIONS.map((item) => {
                  const isSelected = selectedGenres.includes(item.query);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.preferenceCard,
                        { backgroundColor: item.color },
                        isSelected && styles.preferenceCardSelected,
                      ]}
                      onPress={() => toggleGenreSelection(item.query)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={item.icon as any} size={24} color="#FFFFFF" style={styles.prefIcon} />
                      <Text style={styles.preferenceName}>{item.name}</Text>
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#1DB954" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              {currentStep === 1 ? (
                <TouchableOpacity
                  style={[
                    styles.savePrefsBtn,
                    selectedLanguages.length < 1 && styles.savePrefsBtnDisabled,
                  ]}
                  disabled={selectedLanguages.length < 1}
                  onPress={() => setCurrentStep(2)}
                >
                  <Text style={styles.savePrefsText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.savePrefsBtn,
                    selectedGenres.length < 2 && styles.savePrefsBtnDisabled,
                  ]}
                  disabled={selectedGenres.length < 2}
                  onPress={handleSavePreferences}
                >
                  <Text style={styles.savePrefsText}>Personalize My Feed</Text>
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Liked Songs Details Submodal */}
      <Modal
        visible={isLikedSongsModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsLikedSongsModalVisible(false)}
      >
        <SafeAreaView style={styles.likedSongsContainer}>
          {/* Modal Header */}
          <View style={styles.likedSongsHeader}>
            <TouchableOpacity onPress={() => setIsLikedSongsModalVisible(false)} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.likedSongsTitle} numberOfLines={1}>
              Liked Songs
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Play All Button Row */}
          {likedSongs.length > 0 && (
            <View style={styles.listActionRow}>
              <Text style={styles.songCountText}>{likedSongs.length} songs</Text>
              <TouchableOpacity
                style={styles.playAllButton}
                onPress={() => playTrack(likedSongs[0], likedSongs)}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={24} color="#000000" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </View>
          )}

          {/* List of Liked Songs */}
          <FlatList
            data={likedSongs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
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
                  onPress={() => handlePlaySong(item, likedSongs)}
                  onMenuPress={() => {}}
                  onRemove={() => toggleLikeTrack(item)}
                />
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyLikesContainer}>
                <Ionicons name="heart-outline" size={48} color="#535353" />
                <Text style={styles.emptyLikesText}>
                  No liked songs yet. Tap the heart icon or ellipsis menu to like songs!
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Downloaded Songs Details Submodal */}
      <Modal
        visible={isDownloadsModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsDownloadsModalVisible(false)}
      >
        <SafeAreaView style={styles.likedSongsContainer}>
          {/* Modal Header */}
          <View style={styles.likedSongsHeader}>
            <TouchableOpacity onPress={() => setIsDownloadsModalVisible(false)} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.likedSongsTitle} numberOfLines={1}>
              Downloaded Songs
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Play All Button Row */}
          {downloadedTracks.length > 0 && (
            <View style={styles.listActionRow}>
              <Text style={styles.songCountText}>{downloadedTracks.length} songs</Text>
              <TouchableOpacity
                style={styles.playAllButton}
                onPress={() => playTrack(downloadedTracks[0], downloadedTracks)}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={24} color="#000000" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </View>
          )}

          {/* List of Downloaded Songs */}
          <FlatList
            data={downloadedTracks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
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
                  onPress={() => handlePlaySong(item, downloadedTracks)}
                  onMenuPress={() => {}}
                  onRemove={() => handleRemoveDownload(item.id)}
                />
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyLikesContainer}>
                <Ionicons name="download-outline" size={48} color="#535353" />
                <Text style={styles.emptyLikesText}>
                  No downloaded songs yet. Search and download tracks for offline listening!
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Track Options Modal Triggered from Home */}
      <TrackMenuModal
        visible={isTrackMenuVisible}
        track={menuTrack}
        onClose={() => setIsTrackMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#B3B3B3',
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop:36,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 28,
    height: 28,
    marginRight: 10,
    resizeMode: 'contain',
  },
  profileHeaderImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  greetingText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    padding: 2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  gridTile: {
    width: (width - 40) / 2,
    height: 56,
    backgroundColor: '#282828',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: 56,
    height: 56,
    backgroundColor: '#121212',
  },
  gridTitleWrapper: {
    flex: 1,
    paddingLeft: 8,
    paddingRight: 26,
    justifyContent: 'center',
  },
  gridTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  ellipsisBtn: {
    position: 'absolute',
    right: 4,
    padding: 8,
  },
  activeText: {
    color: '#1DB954',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  horizontalScroll: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  albumCard: {
    width: 120,
    marginRight: 16,
  },
  albumArt: {
    width: 120,
    height: 120,
    borderRadius: 6,
    backgroundColor: '#282828',
    marginBottom: 8,
  },
  albumMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  albumTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  albumArtist: {
    color: '#B3B3B3',
    fontSize: 11,
  },

  // Modal Custom Styling
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    marginHorizontal: 16,
    justifyContent: 'space-between',
  },
  modalHeaderContainer: {
    paddingTop: 36,
    paddingBottom: 20,
    alignItems: 'center',
  },
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  backBtn: {
    padding: 2,
  },
  stepTitle: {
    color: '#1DB954',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#B3B3B3',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  preferenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 24,
  },
  preferenceCard: {
    width: (width - 44) / 2,
    height: 90,
    borderRadius: 6,
    padding: 16,
    justifyContent: 'space-between',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  preferenceCardSelected: {
    borderColor: '#1DB954',
  },
  prefIcon: {
    opacity: 0.8,
  },
  preferenceName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  modalFooter: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  savePrefsBtn: {
    backgroundColor: '#1DB954',
    height: 50,
    width: '80%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savePrefsBtnDisabled: {
    backgroundColor: '#282828',
    opacity: 0.5,
  },
  savePrefsText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  likedSongsContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  likedSongsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  likedSongsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyLikesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyLikesText: {
    color: '#B3B3B3',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  listActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  songCountText: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  playAllButton: {
    backgroundColor: '#1DB954',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  smartMixBanner: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  smartMixGradient: {
    padding: 16,
  },
  smartMixContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smartMixLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  smartMixIcon: {
    marginRight: 12,
  },
  smartMixTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  smartMixSubtitle: {
    color: '#B3B3B3',
    fontSize: 11,
    marginTop: 2,
  },
});
