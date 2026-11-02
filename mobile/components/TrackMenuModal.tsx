import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { Track, useAudio } from '../context/AudioContext';
import { allArtistNames, pickImage } from '../services/musicApi';
import { useOffline } from '../utils/offline';

const { height, width } = Dimensions.get('window');

interface TrackMenuModalProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  /** Called before navigating away (e.g. so the full-screen player can close itself). */
  onNavigate?: () => void;
}

export default function TrackMenuModal({ visible, track, onClose, onNavigate }: TrackMenuModalProps) {
  const { user } = useUser();
  const router = useRouter();
  const { downloadTrack, removeDownload, playNext, addToQueue, startRadio, likedSongs, toggleLikeTrack } = useAudio();
  const { downloadedIds, progress } = useOffline();

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  // Custom Playlist Creator overlay states
  const [isCreatePromptVisible, setIsCreatePromptVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const isDownloaded = track ? downloadedIds.has(track.id) : false;
  const downloading = track ? progress[track.id] !== undefined : false;
  const downloadProgress = track ? Math.round((progress[track.id] ?? 0) * 100) : 0;
  const isCurrentlyLiked = track ? likedSongs.some((t) => t.id === track.id) : false;

  useEffect(() => {
    if (visible) {
      loadPlaylists();
      setShowPlaylistPicker(false);
      setIsCreatePromptVisible(false);
      setNewPlaylistName('');
    }
  }, [visible, track]);

  const loadPlaylists = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
      }
    } catch (e) {
      console.error('Error loading playlists:', e);
    }
  };

  // 1. Download Track (saved to device; works offline)
  const handleDownload = async () => {
    if (!track) return;
    onClose();
    try {
      const ok = await downloadTrack(track);
      if (ok) Alert.alert('Downloaded', `"${track.name}" is now available offline.`);
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download failed', 'Could not download this song. Check your connection and try again.');
    }
  };

  // 2. Remove Download
  const handleRemoveDownload = async () => {
    if (!track) return;
    await removeDownload(track.id);
    onClose();
  };

  const go = (path: string) => {
    onNavigate?.();
    onClose();
    router.push(path as any);
  };

  // 3. Trigger Create Playlist overlay
  const handleCreatePlaylist = () => {
    setNewPlaylistName('');
    setIsCreatePromptVisible(true);
  };

  const handleConfirmCreatePlaylist = async () => {
    if (!track || !newPlaylistName.trim() || !user) return;
    try {
      const name = newPlaylistName.trim();
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: name }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const createdPlaylist = data.playlist;

        await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists/${createdPlaylist.id}/songs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track }),
        });

        Alert.alert('Success', `Playlist "${name}" created and song added!`);
      }
      setIsCreatePromptVisible(false);
      setNewPlaylistName('');
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  // 4. Add to Existing Playlist
  const handleAddToPlaylist = async (playlistId: string) => {
    if (!track) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track }),
      });

      if (res.ok) {
        Alert.alert('Success', 'Song added to playlist!');
      } else {
        const errData = await res.json();
        Alert.alert('Error', errData.error || 'Failed to add song to playlist');
      }
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLikeToggle = async () => {
    if (!track) return;
    await toggleLikeTrack(track);
    onClose();
  };

  if (!track) return null;

  const songImg = pickImage(track.image, 'md');
  const artistRef = track.artists?.primary?.[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheetContainer} onStartShouldSetResponder={() => true}>
          
          {/* Grab Bar */}
          <View style={styles.grabBar} />

          {/* Render the Custom Creator overlay inside the sheet if triggered */}
          {isCreatePromptVisible ? (
            <View style={styles.promptContainer}>
              <Text style={styles.promptTitle}>New Playlist</Text>
              <Text style={styles.promptSubtitle}>Enter a name for this playlist</Text>
              <TextInput
                style={styles.promptInput}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                placeholder="e.g. Chill Mix"
                placeholderTextColor="#7A7A7A"
                autoFocus={true}
              />
              <View style={styles.promptButtons}>
                <TouchableOpacity
                  onPress={() => setIsCreatePromptVisible(false)}
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
          ) : (
            <>
              {/* Track Detail Header */}
              <View style={styles.trackDetailsHeader}>
                <Image source={{ uri: songImg }} style={styles.albumArt} />
                <View style={styles.trackMeta}>
                  <Text style={styles.trackName} numberOfLines={1}>
                    {track.name}
                  </Text>
                  <Text style={styles.artistName} numberOfLines={1}>
                    {allArtistNames(track)}
                  </Text>
                </View>
              </View>

              {/* Download progress bar */}
              {downloading && (
                <View style={styles.progressContainer}>
                  <ActivityIndicator size="small" color="#1DB954" style={{ marginRight: 8 }} />
                  <Text style={styles.progressText}>Downloading track... {downloadProgress}%</Text>
                </View>
              )}

              {/* Main Actions Sheet */}
              {!showPlaylistPicker ? (
                <ScrollView contentContainerStyle={styles.actionsList}>
                  
                  {/* Queue + radio */}
                  <TouchableOpacity style={styles.actionRow} onPress={() => { playNext(track); onClose(); }}>
                    <Ionicons name="play-forward-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.actionText}>Play next</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionRow} onPress={() => { addToQueue(track); onClose(); }}>
                    <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.actionText}>Add to queue</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionRow} onPress={() => { onNavigate?.(); onClose(); startRadio(track); }}>
                    <Ionicons name="radio-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.actionText}>Start song radio</Text>
                  </TouchableOpacity>

                  {/* Playlist Action */}
                  <TouchableOpacity style={styles.actionRow} onPress={() => setShowPlaylistPicker(true)}>
                    <Ionicons name="musical-notes-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.actionText}>Add to playlist</Text>
                  </TouchableOpacity>

                  {/* Like/Unlike Action */}
                  <TouchableOpacity style={styles.actionRow} onPress={handleLikeToggle}>
                    <Ionicons
                      name={isCurrentlyLiked ? "heart" : "heart-outline"}
                      size={22}
                      color={isCurrentlyLiked ? "#FF2D55" : "#FFFFFF"}
                    />
                    <Text style={[styles.actionText, isCurrentlyLiked && { color: "#FF2D55" }]}>
                      {isCurrentlyLiked ? "Remove from Liked Songs" : "Like this song"}
                    </Text>
                  </TouchableOpacity>

                  {/* Download Action */}
                  {!isDownloaded ? (
                    <TouchableOpacity style={[styles.actionRow, downloading && styles.disabledRow]} onPress={handleDownload} disabled={downloading}>
                      <Ionicons name="download-outline" size={22} color="#FFFFFF" />
                      <Text style={styles.actionText}>Download for offline</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.actionRow} onPress={handleRemoveDownload}>
                      <Ionicons name="checkmark-circle" size={22} color="#1DB954" />
                      <Text style={styles.actionText}>Downloaded · tap to remove</Text>
                    </TouchableOpacity>
                  )}

                  {track.album?.id && (
                    <TouchableOpacity style={styles.actionRow} onPress={() => go(`/album/${track.album!.id}`)}>
                      <Ionicons name="disc-outline" size={22} color="#FFFFFF" />
                      <Text style={styles.actionText}>Go to album</Text>
                    </TouchableOpacity>
                  )}
                  {artistRef?.id && (
                    <TouchableOpacity style={styles.actionRow} onPress={() => go(`/artist/${artistRef.id}?name=${encodeURIComponent(artistRef.name)}`)}>
                      <Ionicons name="person-outline" size={22} color="#FFFFFF" />
                      <Text style={styles.actionText}>Go to artist</Text>
                    </TouchableOpacity>
                  )}

                  {/* Close Row */}
                  <TouchableOpacity style={[styles.actionRow, { borderTopWidth: 1, borderColor: '#282828', marginTop: 12 }]} onPress={onClose}>
                    <Ionicons name="close-circle-outline" size={22} color="#B3B3B3" />
                    <Text style={[styles.actionText, { color: '#B3B3B3' }]}>Cancel</Text>
                  </TouchableOpacity>

                </ScrollView>
              ) : (
                /* Playlist Picker Sub-View */
                <View style={styles.playlistSubView}>
                  <View style={styles.subHeader}>
                    <TouchableOpacity onPress={() => setShowPlaylistPicker(false)} style={styles.backBtn}>
                      <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.subTitle}>Add to playlist</Text>
                    <View style={{ width: 20 }} />
                  </View>

                  <ScrollView contentContainerStyle={styles.playlistList} style={{ maxHeight: height * 0.35 }}>
                    
                    {/* Create Playlist Option */}
                    <TouchableOpacity style={styles.createPlaylistRow} onPress={handleCreatePlaylist}>
                      <View style={styles.plusBox}>
                        <Ionicons name="add" size={24} color="#FFFFFF" />
                      </View>
                      <Text style={styles.createPlaylistText}>Create new playlist</Text>
                    </TouchableOpacity>

                    {/* List of existing playlists */}
                    {playlists.map((pl) => (
                      <TouchableOpacity key={pl.id} style={styles.playlistRow} onPress={() => handleAddToPlaylist(pl.id)}>
                        <View style={styles.musicIconBox}>
                          <Ionicons name="musical-note" size={20} color="#FFFFFF" />
                        </View>
                        <Text style={styles.playlistName} numberOfLines={1}>
                          {pl.name}
                        </Text>
                      </TouchableOpacity>
                    ))}

                  </ScrollView>
                </View>
              )}
            </>
          )}

        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
    maxHeight: height * 0.7,
  },
  grabBar: {
    width: 36,
    height: 4,
    backgroundColor: '#7A7A7A',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12,
  },
  trackDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#0A0A0F',
  },
  trackMeta: {
    flex: 1,
    marginLeft: 14,
  },
  trackName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  artistName: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  actionsList: {
    paddingTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledRow: {
    opacity: 0.5,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#282828',
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  progressText: {
    color: '#1DB954',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Playlist Sub-view
  playlistSubView: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 10,
  },
  backBtn: {
    padding: 2,
  },
  subTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playlistList: {
    paddingBottom: 20,
  },
  createPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  plusBox: {
    width: 44,
    height: 44,
    backgroundColor: '#282828',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPlaylistText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  musicIconBox: {
    width: 44,
    height: 44,
    backgroundColor: '#282828',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },

  // Inner prompt layout inside options sheet container
  promptContainer: {
    padding: 24,
    alignItems: 'center',
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
});
