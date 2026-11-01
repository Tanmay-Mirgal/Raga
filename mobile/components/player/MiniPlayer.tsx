import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudio } from '../../context/AudioContext';
import { usePlaybackProgress } from '../../context/playbackProgress';
import { allArtistNames, pickImage } from '../../services/musicApi';
import { useOffline } from '../../utils/offline';

function ProgressLine() {
  const { position, duration } = usePlaybackProgress();
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

export default function MiniPlayer({ bottom, onOpen }: { bottom: number; onOpen: () => void }) {
  const { currentTrack, isPlaying, isBuffering, likedSongs, toggleLikeTrack, togglePlay, skipToNext } = useAudio();
  const { availableIds } = useOffline();
  if (!currentTrack) return null;

  const isLiked = likedSongs.some((t) => t.id === currentTrack.id);
  const saved = availableIds.has(currentTrack.id);

  return (
    <TouchableOpacity style={[styles.container, { bottom }]} activeOpacity={0.9} onPress={onOpen}>
      <View style={styles.content}>
        <Image source={{ uri: pickImage(currentTrack.image, 'md') }} style={styles.art} />
        <View style={styles.details}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.name}
          </Text>
          <View style={styles.subRow}>
            {saved && <Ionicons name="arrow-down-circle" size={12} color="#1DB954" style={{ marginRight: 4 }} />}
            <Text style={styles.artist} numberOfLines={1}>
              {allArtistNames(currentTrack)}
            </Text>
          </View>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => toggleLikeTrack(currentTrack)} style={styles.btn} hitSlop={6}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? '#1DB954' : '#FFFFFF'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlay} style={styles.btn} hitSlop={6}>
            {isBuffering && isPlaying ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ width: 24, height: 24 }} />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={skipToNext} style={styles.btn} hitSlop={6}>
            <Ionicons name="play-skip-forward" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
      <ProgressLine />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 60,
    backgroundColor: '#282828',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  art: { width: 42, height: 42, borderRadius: 4, backgroundColor: '#121212' },
  details: { flex: 1, marginLeft: 10, justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  subRow: { flexDirection: 'row', alignItems: 'center' },
  artist: { color: '#B3B3B3', fontSize: 11, flexShrink: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 4 },
  btn: { padding: 4 },
  progressTrack: { height: 2, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)' },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF' },
});
