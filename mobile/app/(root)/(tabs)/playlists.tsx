import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, SafeAreaView, FlatList, Dimensions, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import React, { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '@clerk/clerk-expo';
import { useAudio, Track } from '../../../context/AudioContext';
import TrackMenuModal from '../../../components/TrackMenuModal';
import { MemoizedTrackRow } from '../../../components/MemoizedTrackRow';
import { searchSongs } from '../../../services/musicApi';

const { width, height } = Dimensions.get('window');

export default function PlaylistsScreen() {
  const { user } = useUser();
  const { playTrack, currentTrack, isPlaying, logInteraction } = useAudio();

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renamePlaylistName, setRenamePlaylistName] = useState('');

  // States for options menu sheet
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);

  // States for searching & adding songs directly within the selected playlist
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Custom Cross-Platform Create Playlist Modal states (Replaces iOS-only Alert.prompt)
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Load playlists on mount and after user loaded
  useEffect(() => {
    if (user) {
      loadPlaylists();
    }
  }, [user]);

  // Debounced search logic for adding tracks directly
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim()) {
        performPlaylistSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const loadPlaylists = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists?userId=${user.id}`);
      if (res.ok) {
        const saved = await res.json();
        setPlaylists(saved);
      }
    } catch (e) {
      console.error('Error loading playlists:', e);
    }
  };

  const performPlaylistSearch = async (query: string) => {
    try {
      setSearching(true);
      setSearchResults(await searchSongs(query, 0, 10));
    } catch (e) {
      console.log('Could not search songs for playlist:', (e as Error)?.message);
    } finally {
      setSearching(false);
    }
  };

  const handleCreatePlaylist = () => {
    setNewPlaylistName('');
    setIsCreateModalVisible(true);
  };

  const handleConfirmCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !user) return;
    try {
      const name = newPlaylistName.trim();
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: name }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedPlaylists = [...playlists, data.playlist];
        setPlaylists(updatedPlaylists);
      }
      setIsCreateModalVisible(false);
      setNewPlaylistName('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePlaylist = (playlistId: string) => {
    Alert.alert('Delete Playlist', 'Are you sure you want to delete this playlist?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists/${playlistId}`, {
              method: 'DELETE',
            });
            if (res.ok) {
              const updated = playlists.filter((pl) => pl.id !== playlistId);
              setPlaylists(updated);
              setIsPlaylistModalVisible(false);
            }
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const handleOpenRenameModal = () => {
    if (!selectedPlaylist) return;
    setRenamePlaylistName(selectedPlaylist.name);
    setIsRenameModalVisible(true);
  };

  const handleRenamePlaylist = async () => {
    if (!selectedPlaylist || !renamePlaylistName.trim()) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists/${selectedPlaylist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renamePlaylistName.trim() }),
      });
      if (res.ok) {
        setSelectedPlaylist((prev: any) => prev ? { ...prev, name: renamePlaylistName.trim(), title: renamePlaylistName.trim() } : null);
        setPlaylists((prev) =>
          prev.map((pl) =>
            pl.id === selectedPlaylist.id ? { ...pl, name: renamePlaylistName.trim(), title: renamePlaylistName.trim() } : pl
          )
        );
        setIsRenameModalVisible(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenPlaylist = (playlist: any) => {
    setSelectedPlaylist(playlist);
    setSearchQuery('');
    setSearchResults([]);
    setIsPlaylistModalVisible(true);
  };

  const handlePlaySong = (song: Track, list: Track[]) => {
    playTrack(song, list);
  };

  const handleOpenOptions = (track: Track) => {
    setMenuTrack(track);
    setIsMenuVisible(true);
  };

  // Add song directly to the open playlist
  const handleAddSongToPlaylist = async (song: any) => {
    if (!selectedPlaylist || !user) return;

    // Check if song already exists in this playlist
    if (selectedPlaylist.tracks.some((t: any) => t.id === song.id)) {
      Alert.alert('Already Added', 'This song is already in the playlist.');
      return;
    }

    const newTrack = {
      id: song.id,
      name: song.name,
      artists: {
        primary: song.artists?.primary || [{ name: 'Unknown Artist' }]
      },
      image: song.image || [],
      downloadUrl: song.downloadUrl || []
    };

    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists/${selectedPlaylist.id}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track: newTrack }),
      });

      if (res.ok) {
        const updatedTracks = [...selectedPlaylist.tracks, newTrack];
        const updatedPlaylist = { ...selectedPlaylist, tracks: updatedTracks };
        
        const updatedPlaylists = playlists.map((pl) => 
          pl.id === selectedPlaylist.id ? updatedPlaylist : pl
        );

        setPlaylists(updatedPlaylists);
        setSelectedPlaylist(updatedPlaylist);
        
        // Log interaction "playlist_add" to the backend Postgres database
        logInteraction(newTrack, 'playlist_add');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Remove song directly from the open playlist
  const handleRemoveSongFromPlaylist = async (songId: string) => {
    if (!selectedPlaylist) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists/${selectedPlaylist.id}/songs/${songId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const updatedTracks = selectedPlaylist.tracks.filter((t: any) => t.id !== songId);
        const updatedPlaylist = { ...selectedPlaylist, tracks: updatedTracks };
        
        const updatedPlaylists = playlists.map((pl) => 
          pl.id === selectedPlaylist.id ? updatedPlaylist : pl
        );

        setPlaylists(updatedPlaylists);
        setSelectedPlaylist(updatedPlaylist);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <Text style={styles.screenHeader}>Playlists</Text>
        <TouchableOpacity onPress={handleCreatePlaylist} style={styles.createBtn}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Playlists List */}
      {playlists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="musical-notes-outline" size={64} color="#535353" />
          <Text style={styles.emptyTitle}>Create your first playlist</Text>
          <Text style={styles.emptySubtitle}>It's easy, we'll help you.</Text>
          <TouchableOpacity style={styles.createBigBtn} onPress={handleCreatePlaylist}>
            <Text style={styles.createBigBtnText}>Create Playlist</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.playlistRow}
              onPress={() => handleOpenPlaylist(item)}
              activeOpacity={0.7}
            >
              <View style={styles.playlistArtBox}>
                {item.coverImageUrl ? (
                  <Image source={{ uri: item.coverImageUrl }} style={styles.playlistArtImage} />
                ) : (
                  <Ionicons name="musical-notes" size={24} color="#B3B3B3" />
                )}
              </View>
              <View style={styles.playlistMeta}>
                <Text style={styles.playlistName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.playlistInfo}>
                  Playlist • {item.tracks?.length || 0} songs
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B3B3B3" />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Playlist Details Submodal */}
      <Modal
        visible={isPlaylistModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsPlaylistModalVisible(false)}
      >
        {selectedPlaylist && (
          <SafeAreaView style={styles.playlistDetailContainer}>
            {/* List of Playlist Songs */}
            <FlatList
              data={selectedPlaylist.tracks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 60 }}
              initialNumToRender={10}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={true}
              ListHeaderComponent={
                <View style={styles.playlistHeroContainer}>
                  <LinearGradient
                    colors={['#2D46B9', '#121212']}
                    style={styles.playlistHeroGradient}
                  >
                    {/* Back button and title */}
                    <View style={styles.heroNav}>
                      <TouchableOpacity onPress={() => setIsPlaylistModalVisible(false)} style={styles.heroBackBtn}>
                        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.heroNavTitle} numberOfLines={1}>Playlist</Text>
                      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                        <TouchableOpacity onPress={handleOpenRenameModal} style={styles.heroBackBtn}>
                          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeletePlaylist(selectedPlaylist.id)} style={styles.heroDeleteBtn}>
                          <Ionicons name="trash-outline" size={20} color="#FF5252" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Cover Image */}
                    <View style={styles.heroCoverWrapper}>
                      {selectedPlaylist.coverImageUrl ? (
                        <Image
                          source={{ uri: selectedPlaylist.coverImageUrl }}
                          style={styles.heroCoverImage}
                        />
                      ) : selectedPlaylist.tracks && selectedPlaylist.tracks.length > 0 ? (
                        <Image
                          source={{ uri: selectedPlaylist.tracks[0].image?.[2]?.url || selectedPlaylist.tracks[0].image?.[1]?.url || selectedPlaylist.tracks[0].image?.[0]?.url }}
                          style={styles.heroCoverImage}
                        />
                      ) : (
                        <View style={[styles.heroCoverImage, styles.heroCoverPlaceholder]}>
                          <Ionicons name="musical-notes" size={64} color="#535353" />
                        </View>
                      )}
                    </View>

                    {/* Playlist Info */}
                    <View style={styles.heroInfoWrapper}>
                      <TouchableOpacity
                        onPress={handleOpenRenameModal}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.heroTitle}>{selectedPlaylist.name}</Text>
                        <Ionicons name="create-outline" size={18} color="#B3B3B3" style={{ marginBottom: 6 }} />
                      </TouchableOpacity>
                      <Text style={styles.heroSubtitle}>
                        Playlist • {user?.firstName || 'Listener'} • {selectedPlaylist.tracks?.length || 0} songs
                      </Text>
                    </View>

                    {/* Play Button Row */}
                    {selectedPlaylist.tracks && selectedPlaylist.tracks.length > 0 && (
                      <View style={styles.heroActionRow}>
                        <TouchableOpacity
                          style={styles.heroPlayButton}
                          onPress={() => playTrack(selectedPlaylist.tracks[0], selectedPlaylist.tracks)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="play" size={28} color="#000000" style={{ marginLeft: 3 }} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </LinearGradient>

                  {/* Add Songs Widget directly below the play button */}
                  <View style={[styles.headerSearchSection, { paddingHorizontal: 16 }]}>
                    <View style={styles.playlistSearchBar}>
                      <Ionicons name="search" size={18} color="#7A7A7A" />
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search to add songs..."
                        placeholderTextColor="#7A7A7A"
                        style={styles.playlistSearchInput}
                        autoCapitalize="none"
                      />
                      {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                          <Ionicons name="close" size={18} color="#B3B3B3" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {searching ? (
                      <ActivityIndicator size="small" color="#1DB954" style={{ marginTop: 12 }} />
                    ) : (
                      <View style={styles.searchResultsContainer}>
                        {searchResults.map((song) => {
                          const songImg = song.image?.[1]?.url || song.image?.[0]?.url;
                          return (
                            <View key={song.id} style={styles.searchResultRow}>
                              <Image source={{ uri: songImg }} style={styles.searchResultThumb} />
                              <View style={styles.searchResultMeta}>
                                <Text style={styles.searchResultName} numberOfLines={1}>
                                  {song.name}
                                </Text>
                                <Text style={styles.searchResultArtist} numberOfLines={1}>
                                  {song.artists?.primary?.[0]?.name || 'Unknown Artist'}
                                </Text>
                              </View>
                              <TouchableOpacity onPress={() => handleAddSongToPlaylist(song)} style={styles.addBtn}>
                                <Ionicons name="add-circle" size={26} color="#1DB954" />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
              }
              renderItem={({ item }) => {
                const isCurrent = currentTrack?.id === item.id;
                return (
                  <View style={{ paddingHorizontal: 16 }}>
                    <MemoizedTrackRow
                      id={item.id}
                      name={item.name}
                      artist={item.artists?.primary?.[0]?.name || 'Unknown Artist'}
                      imageUrl={item.image?.[1]?.url || item.image?.[0]?.url}
                      isCurrent={isCurrent}
                      isPlaying={isPlaying}
                      onPress={() => handlePlaySong(item, selectedPlaylist.tracks)}
                      onMenuPress={() => {}} // Won't be used since onRemove is passed
                      onRemove={() => handleRemoveSongFromPlaylist(item.id)}
                    />
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={[styles.emptyPlaylistContainer, { paddingHorizontal: 16 }]}>
                  <Ionicons name="musical-notes-outline" size={48} color="#535353" />
                  <Text style={styles.emptyPlaylistText}>
                    This playlist is empty. Search and add songs above!
                  </Text>
                </View>
              }
              ListFooterComponent={<View style={{ height: 40 }} />}
            />
          </SafeAreaView>
        )}
      </Modal>

      {/* Custom Dialog for Creating Playlist (Fully Android & iOS compatible) */}
      <Modal
        visible={isCreateModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.promptOverlay}>
          <View style={styles.promptBox}>
            <Text style={styles.promptTitle}>New Playlist</Text>
            <Text style={styles.promptSubtitle}>Enter a name for this playlist</Text>
            <TextInput
              style={styles.promptInput}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              placeholder="e.g. My Vibe Mix"
              placeholderTextColor="#7A7A7A"
              autoFocus={true}
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity
                onPress={() => setIsCreateModalVisible(false)}
                style={[styles.promptBtn, styles.cancelBtn]}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmCreatePlaylist}
                style={[styles.promptBtn, styles.submitBtn]}
              >
                <Text style={styles.submitBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Dialog for Renaming Playlist (Fully Android & iOS compatible) */}
      <Modal
        visible={isRenameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <View style={styles.promptOverlay}>
          <View style={styles.promptBox}>
            <Text style={styles.promptTitle}>Rename Playlist</Text>
            <Text style={styles.promptSubtitle}>Enter a new name for this playlist</Text>
            <TextInput
              style={styles.promptInput}
              value={renamePlaylistName}
              onChangeText={setRenamePlaylistName}
              placeholder="e.g. My Updated Mix"
              placeholderTextColor="#7A7A7A"
              autoFocus={true}
            />
            <View style={styles.promptButtons}>
              <TouchableOpacity
                onPress={() => setIsRenameModalVisible(false)}
                style={[styles.promptBtn, styles.cancelBtn]}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRenamePlaylist}
                style={[styles.promptBtn, styles.submitBtn]}
              >
                <Text style={styles.submitBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Track Options Menu Sheet */}
      <TrackMenuModal
        visible={isMenuVisible}
        track={menuTrack}
        onClose={() => setIsMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 54,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  screenHeader: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  createBtn: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 18,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#B3B3B3',
    fontSize: 13,
    marginBottom: 24,
  },
  createBigBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  createBigBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  playlistArtBox: {
    width: 56,
    height: 56,
    backgroundColor: '#282828',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playlistArtImage: {
    width: 56,
    height: 56,
    borderRadius: 4,
  },
  playlistMeta: {
    flex: 1,
    marginLeft: 16,
  },
  playlistName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playlistInfo: {
    color: '#B3B3B3',
    fontSize: 12,
  },

  // Playlist detail overlay modal
  playlistDetailContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  playlistDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 12,
  },
  backBtn: {
    padding: 6,
  },
  playlistDetailTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  deleteBtn: {
    padding: 6,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  activeSongRow: {
    backgroundColor: 'rgba(29, 185, 84, 0.05)',
  },
  songThumb: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#282828',
  },
  songMeta: {
    flex: 1,
    marginLeft: 14,
  },
  songName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  activeText: {
    color: '#1DB954',
  },
  songArtist: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  removeSongBtn: {
    padding: 8,
  },
  emptyPlaylistContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 14,
  },
  emptyPlaylistText: {
    color: '#B3B3B3',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Add Songs Search Section in Playlist Detail
  headerSearchSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  searchSectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  playlistSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#282828',
    height: 40,
    borderRadius: 4,
    paddingHorizontal: 12,
    gap: 8,
  },
  playlistSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  searchResultsContainer: {
    marginTop: 16,
    gap: 12,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  searchResultThumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#282828',
  },
  searchResultMeta: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  searchResultArtist: {
    color: '#B3B3B3',
    fontSize: 11,
  },
  addBtn: {
    padding: 4,
  },

  // Custom prompt overlay styles
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptBox: {
    width: width * 0.85,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3E3E3E',
  },
  promptTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  promptSubtitle: {
    color: '#B3B3B3',
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  promptInput: {
    width: '100%',
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4A4A4A',
  },
  promptButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  promptBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#7A7A7A',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#1DB954',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playlistHeroContainer: {
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  playlistHeroGradient: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  heroNav: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroBackBtn: {
    padding: 4,
  },
  heroNavTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  heroDeleteBtn: {
    padding: 4,
  },
  heroCoverWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    marginBottom: 24,
  },
  heroCoverImage: {
    width: 180,
    height: 180,
    borderRadius: 8,
  },
  heroCoverPlaceholder: {
    backgroundColor: '#282828',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfoWrapper: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#B3B3B3',
    fontSize: 13,
    textAlign: 'center',
  },
  heroActionRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPlayButton: {
    backgroundColor: '#1DB954',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
});
