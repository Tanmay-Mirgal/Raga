import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, SafeAreaView, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useAuth, useUser } from '@clerk/clerk-expo';
import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { clearHomeCache } from './index';
import { useAudio, Track } from '../../../context/AudioContext';
import TrackMenuModal from '../../../components/TrackMenuModal';

const { height, width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const { playTrack, downloadedTracks, refreshDownloads, isPlaying, currentTrack, likedSongs } = useAudio();

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);

  // States for options menu sheet
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);

  const displayName = user?.fullName || user?.firstName || user?.emailAddresses[0]?.emailAddress.split('@')[0] || 'Raga Listener';
  const emailAddress = user?.emailAddresses[0]?.emailAddress || 'listener@raga.com';
  const userImage = user?.imageUrl;

  useEffect(() => {
    if (user) {
      loadLibraryData();
    }
  }, [user, isMenuVisible, isPlaylistModalVisible]);

  const loadLibraryData = async () => {
    if (!user) return;
    try {
      await refreshDownloads();

      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists?userId=${user.id}`);
      if (res.ok) {
        const saved = await res.json();
        console.log('[Library] Playlists fetched:', JSON.stringify(saved, null, 2));
        setPlaylists(saved);
      }
    } catch (e) {
      console.error('Error loading library data:', e);
    }
  };

  const handleLogOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out from Raga?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  const handleResetPreferences = async () => {
    // Reset preferences in database
    if (!user) return;
    try {
      await SecureStore.deleteItemAsync('has_set_preferences');
      clearHomeCache();
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/users/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, languages: [], genres: [] }),
      });
      if (res.ok) {
        Alert.alert(
          'Preferences Reset',
          'Your music vibes have been cleared in database. Redirecting to Home to choose again!',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/(root)/(tabs)/' as any);
              },
            },
          ]
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Create Playlist Dialog
  const handleCreatePlaylist = () => {
    Alert.prompt(
      'New Playlist',
      'Enter a name for your playlist',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (name?: string) => {
            if (!name || !name.trim() || !user) return;
            try {
              const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, title: name.trim() }),
              });
              if (res.ok) {
                const data = await res.json();
                setPlaylists((prev) => [...prev, data.playlist]);
                Alert.alert('Success', `Playlist "${name.trim()}" created!`);
              }
            } catch (e) {
              console.error(e);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Delete Playlist
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

  const handleOpenPlaylist = (playlist: any) => {
    setSelectedPlaylist(playlist);
    setIsPlaylistModalVisible(true);
  };

  const handlePlaySong = (song: Track, list: Track[]) => {
    playTrack(song, list);
  };

  const handleOpenOptions = (track: Track) => {
    setMenuTrack(track);
    setIsMenuVisible(true);
  };

  const initialLetter = displayName.charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Header Profile Info */}
        <View style={styles.profileHeader}>
          {userImage ? (
            <Image source={{ uri: userImage }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{initialLetter}</Text>
            </View>
          )}
          <Text style={styles.nameText}>{displayName}</Text>
          <Text style={styles.emailText}>{emailAddress}</Text>
        </View>

        {/* Stats Counter Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{downloadedTracks.length}</Text>
            <Text style={styles.statLabel}>Downloads</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{playlists.length}</Text>
            <Text style={styles.statLabel}>Playlists</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{likedSongs.length}</Text>
            <Text style={styles.statLabel}>Liked Songs</Text>
          </View>
        </View>

        {/* Playlists Shelf */}
        <View style={styles.librarySection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>My Playlists</Text>
            <TouchableOpacity onPress={handleCreatePlaylist} style={styles.createBtn}>
              <Ionicons name="add-circle-outline" size={24} color="#1DB954" />
            </TouchableOpacity>
          </View>
          
          {playlists.length === 0 ? (
            <Text style={styles.emptyText}>No playlists created yet. Start organizing your hits!</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {playlists.map((pl) => (
                <TouchableOpacity key={pl.id} style={styles.playlistCard} onPress={() => handleOpenPlaylist(pl)}>
                  {pl.coverImageUrl ? (
                    <Image source={{ uri: pl.coverImageUrl }} style={styles.playlistArt} />
                  ) : (
                    <View style={styles.playlistArtPlaceholder}>
                      <Ionicons name="musical-notes" size={32} color="#B3B3B3" />
                    </View>
                  )}
                  <Text style={styles.playlistName} numberOfLines={1}>
                    {pl.name}
                  </Text>
                  <Text style={styles.playlistCount}>
                    {pl.tracks?.length || 0} tracks
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Downloaded Songs Shelf (Offline list) */}
        <View style={styles.librarySection}>
          <Text style={styles.sectionTitle}>Downloaded Songs (Offline)</Text>
          {downloadedTracks.length === 0 ? (
            <Text style={styles.emptyText}>No downloaded songs. Tap ellipsis (...) next to any song to download for offline playback!</Text>
          ) : (
            <View style={styles.downloadsList}>
              {downloadedTracks.map((song) => {
                const songImg = song.image?.[1]?.url || song.image?.[0]?.url;
                const isCurrent = currentTrack?.id === song.id;
                return (
                  <TouchableOpacity
                    key={song.id}
                    style={[styles.songRow, isCurrent && styles.activeSongRow]}
                    onPress={() => handlePlaySong(song, downloadedTracks)}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: songImg }} style={styles.songThumb} />
                    <View style={styles.songMeta}>
                      <Text style={[styles.songName, isCurrent && styles.activeText]} numberOfLines={1}>
                        {song.name}
                      </Text>
                      <Text style={styles.songArtist} numberOfLines={1}>
                        {song.artists?.primary?.[0]?.name || 'Unknown Artist'}
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={18} color="#1DB954" style={{ marginRight: 8 }} />
                    <TouchableOpacity onPress={() => handleOpenOptions(song)} style={styles.optionsBtn}>
                      <Ionicons name="ellipsis-vertical" size={20} color="#B3B3B3" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Settings Options */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsHeader}>Settings</Text>

          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/settings' as any)}>
            <View style={styles.rowLeft}>
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              <Text style={styles.rowText}>Playback, offline & storage</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#B3B3B3" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsRow} onPress={handleResetPreferences}>
            <View style={styles.rowLeft}>
              <Ionicons name="musical-notes-outline" size={20} color="#FFFFFF" />
              <Text style={styles.rowText}>Update music preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#B3B3B3" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsRow} onPress={handleLogOut}>
            <View style={styles.rowLeft}>
              <Ionicons name="log-out-outline" size={20} color="#FF5252" />
              <Text style={[styles.rowText, { color: '#FF5252' }]}>Log Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#B3B3B3" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Playlist Tracks Detailed Overlay Modal */}
      <Modal
        visible={isPlaylistModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsPlaylistModalVisible(false)}
      >
        {selectedPlaylist && (
          <SafeAreaView style={styles.playlistDetailContainer}>
            <View style={styles.playlistDetailHeader}>
              <TouchableOpacity onPress={() => setIsPlaylistModalVisible(false)} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.playlistDetailTitle} numberOfLines={1}>
                {selectedPlaylist.name}
              </Text>
              <TouchableOpacity onPress={() => handleDeletePlaylist(selectedPlaylist.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={22} color="#FF5252" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedPlaylist.tracks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              ListHeaderComponent={
                <View style={styles.detailHeaderComponent}>
                  {selectedPlaylist.coverImageUrl ? (
                    <Image source={{ uri: selectedPlaylist.coverImageUrl }} style={styles.detailCoverImage} />
                  ) : (
                    <View style={styles.detailCoverPlaceholder}>
                      <Ionicons name="musical-notes" size={48} color="#B3B3B3" />
                    </View>
                  )}
                  <Text style={styles.detailPlaylistTitle}>{selectedPlaylist.name}</Text>
                  <Text style={styles.detailPlaylistSubtitle}>{selectedPlaylist.tracks?.length || 0} songs</Text>
                </View>
              }
              renderItem={({ item }) => {
                const songImg = item.image?.[1]?.url || item.image?.[0]?.url;
                const isCurrent = currentTrack?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.songRow, isCurrent && styles.activeSongRow]}
                    onPress={() => handlePlaySong(item, selectedPlaylist.tracks)}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: songImg }} style={styles.songThumb} />
                    <View style={styles.songMeta}>
                      <Text style={[styles.songName, isCurrent && styles.activeText]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.songArtist} numberOfLines={1}>
                        {item.artists?.primary?.[0]?.name || 'Unknown Artist'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleOpenOptions(item)} style={styles.optionsBtn}>
                      <Ionicons name="ellipsis-vertical" size={20} color="#B3B3B3" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyPlaylistContainer}>
                  <Ionicons name="musical-notes-outline" size={48} color="#535353" />
                  <Text style={styles.emptyPlaylistText}>
                    This playlist is empty. Add songs from Home or Search!
                  </Text>
                </View>
              }
            />
          </SafeAreaView>
        )}
      </Modal>

      {/* Global Track Options Modal Triggered from Profile Screen */}
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
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: '#282828',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLetter: {
    color: '#000000',
    fontSize: 42,
    fontWeight: 'bold',
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emailText: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#181818',
    marginHorizontal: 16,
    borderRadius: 8,
    paddingVertical: 18,
    marginBottom: 32,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  divider: {
    height: 32,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  librarySection: {
    marginBottom: 32,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 16,
  },
  createBtn: {
    paddingRight: 16,
  },
  emptyText: {
    color: '#B3B3B3',
    fontSize: 13,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  horizontalScroll: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  playlistCard: {
    width: 110,
    marginRight: 16,
  },
  playlistArtPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 6,
    backgroundColor: '#282828',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  playlistArt: {
    width: 110,
    height: 110,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#282828',
  },
  playlistName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  playlistCount: {
    color: '#B3B3B3',
    fontSize: 11,
  },
  downloadsList: {
    paddingHorizontal: 16,
    gap: 10,
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
  optionsBtn: {
    padding: 8,
  },
  settingsSection: {
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  settingsHeader: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  logOutBtn: {
    backgroundColor: '#1DB954',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 32,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  logOutText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },

  // Playlist details submodal
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
  emptyPlaylistContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 14,
  },
  emptyPlaylistText: {
    color: '#B3B3B3',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  detailHeaderComponent: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  detailCoverImage: {
    width: 180,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#282828',
  },
  detailCoverPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#282828',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailPlaylistTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  detailPlaylistSubtitle: {
    color: '#B3B3B3',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});
