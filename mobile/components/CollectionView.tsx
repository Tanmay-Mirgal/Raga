import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudio } from '../context/AudioContext';
import { allArtistNames, pickImage, type Track } from '../services/musicApi';
import { formatTotalDuration } from '../utils/format';
import { useOffline } from '../utils/offline';
import { MemoizedTrackRow } from './MemoizedTrackRow';
import TrackMenuModal from './TrackMenuModal';

interface Props {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  tracks: Track[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  tint?: string;
}

/** Shared layout for album and playlist pages: cover, Play / Shuffle / Download, track list. */
export default function CollectionView({ title, subtitle, description, imageUrl, tracks, loading, failed, onRetry, tint = '#2A3B4D' }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playTrack, currentTrack, isPlaying, isShuffle, toggleShuffle, downloadTrack } = useAudio();
  const { downloadedIds, progress } = useOffline();
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);

  const total = tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  const allDownloaded = tracks.length > 0 && tracks.every((t) => downloadedIds.has(t.id));
  const downloadingCount = tracks.filter((t) => progress[t.id] !== undefined).length;

  const play = async (shuffle: boolean) => {
    if (tracks.length === 0) return;
    if (shuffle !== isShuffle) await toggleShuffle();
    const start = shuffle ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[0];
    await playTrack(start, tracks);
  };

  const downloadAll = async () => {
    if (allDownloaded || downloadingCount > 0) return;
    let failures = 0;
    for (const t of tracks) {
      try {
        if (!(await downloadTrack(t))) {
          failures++;
          break; // blocked (offline / cellular): the track helper already explained why
        }
      } catch {
        failures++;
      }
    }
    if (failures > 0) Alert.alert('Some songs were not downloaded', 'Check your connection and try again.');
  };

  const header = (
    <View>
      <LinearGradient colors={[tint, '#121212']} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.cover} /> : <View style={[styles.cover, styles.coverEmpty]} />}
      </LinearGradient>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        {!!description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {tracks.length > 0 && (
          <Text style={styles.subtitle}>
            {tracks.length} songs{total > 0 ? ` · ${formatTotalDuration(total)}` : ''}
          </Text>
        )}
        <View style={styles.actions}>
          <TouchableOpacity onPress={downloadAll} hitSlop={8} disabled={tracks.length === 0}>
            {downloadingCount > 0 ? (
              <ActivityIndicator color="#1DB954" />
            ) : (
              <Ionicons
                name={allDownloaded ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                size={30}
                color={allDownloaded ? '#1DB954' : '#B3B3B3'}
              />
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => play(true)} hitSlop={8} style={{ marginRight: 20 }} disabled={tracks.length === 0}>
            <Ionicons name="shuffle" size={30} color="#1DB954" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => play(false)} style={styles.playBtn} disabled={tracks.length === 0}>
            <Ionicons name="play" size={28} color="#000000" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>
      </View>
      {loading && tracks.length === 0 && <ActivityIndicator color="#1DB954" style={{ marginTop: 32 }} />}
      {failed && tracks.length === 0 && !loading && (
        <View style={styles.failed}>
          <Ionicons name="cloud-offline-outline" size={40} color="#535353" />
          <Text style={styles.failedText}>Could not load this page. Check your connection.</Text>
          <TouchableOpacity onPress={onRetry} style={styles.retry}>
            <Text style={{ color: '#000', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <FlatList
        data={tracks}
        keyExtractor={(item, i) => `${item.id}-${i}`}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 140 }}
        initialNumToRender={12}
        windowSize={7}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <MemoizedTrackRow
              id={item.id}
              name={item.name}
              artist={allArtistNames(item)}
              imageUrl={pickImage(item.image, 'md')}
              isCurrent={currentTrack?.id === item.id}
              isPlaying={isPlaying}
              onPress={() => playTrack(item, tracks)}
              onMenuPress={() => setMenuTrack(item)}
            />
          </View>
        )}
      />
      <TrackMenuModal visible={!!menuTrack} track={menuTrack} onClose={() => setMenuTrack(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 20 },
  back: { alignSelf: 'flex-start', padding: 8, marginLeft: 4 },
  cover: { width: 200, height: 200, borderRadius: 6, backgroundColor: '#282828', marginTop: 4 },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  info: { paddingHorizontal: 16, paddingTop: 8 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  description: { color: '#B3B3B3', fontSize: 13, marginTop: 4 },
  subtitle: { color: '#B3B3B3', fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  failed: { alignItems: 'center', padding: 32, gap: 12 },
  failedText: { color: '#B3B3B3', textAlign: 'center' },
  retry: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1DB954' },
});
