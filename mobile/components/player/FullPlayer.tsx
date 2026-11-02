import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAudio } from '../../context/AudioContext';
import { allArtistNames, pickImage } from '../../services/musicApi';
import { formatCountdown, tintFor } from '../../utils/format';
import { useOffline } from '../../utils/offline';
import SeekBar from '../SeekBar';
import TrackMenuModal from '../TrackMenuModal';
import LyricsModal from './LyricsModal';
import QueueModal from './QueueModal';
import SleepTimerModal from './SleepTimerModal';

const { width } = Dimensions.get('window');
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function FullPlayer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    isShuffle,
    repeatMode,
    playbackRate,
    likedSongs,
    sleepTimerTimeLeft,
    sleepAtEndOfTrack,
    togglePlay,
    seekTo,
    skipToNext,
    skipToPrevious,
    toggleShuffle,
    toggleRepeat,
    setPlaybackRate,
    toggleLikeTrack,
  } = useAudio();
  const { availableIds, progress } = useOffline();

  const [menuOpen, setMenuOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);

  // Cross-fading background tinted per song.
  const [color, setColor] = useState('#0A0A0F');
  const [prevColor, setPrevColor] = useState('#0A0A0F');
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!currentTrack) return;
    setPrevColor(color);
    setColor(tintFor(currentTrack.id));
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  const isLiked = likedSongs.some((t) => t.id === currentTrack.id);
  const saved = availableIds.has(currentTrack.id);
  const downloading = progress[currentTrack.id] !== undefined;
  const artist = currentTrack.artists.primary[0];

  const openArtist = () => {
    if (!artist?.id) return;
    onClose();
    router.push(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}` as any);
  };
  const openAlbum = () => {
    if (!currentTrack.album?.id) return;
    onClose();
    router.push(`/album/${currentTrack.album.id}` as any);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
        <LinearGradient colors={[prevColor, '#0A0A0F', '#0A0A0F']} style={StyleSheet.absoluteFillObject} />
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fade }]}>
          <LinearGradient colors={[color, '#0A0A0F', '#0A0A0F']} style={StyleSheet.absoluteFillObject} />
        </Animated.View>

        <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', paddingBottom: 24 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity disabled={!currentTrack.album?.id} onPress={openAlbum} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.headerLabel}>PLAYING FROM ALBUM</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {currentTrack.album?.name ?? 'Now playing'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.headerBtn}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.artworkWrap}>
            <Image source={{ uri: pickImage(currentTrack.image, 'lg') }} style={styles.artwork} />
          </View>

          <View style={styles.metaRow}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={styles.title} numberOfLines={1}>
                {currentTrack.name}
              </Text>
              <TouchableOpacity disabled={!artist?.id} onPress={openArtist}>
                <Text style={styles.artist} numberOfLines={1}>
                  {allArtistNames(currentTrack)}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => toggleLikeTrack(currentTrack)} hitSlop={8}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={28} color={isLiked ? '#1DB954' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>

          <View style={styles.seekWrap}>
            <SeekBar onSeek={seekTo} />
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={toggleShuffle} hitSlop={8}>
              <Ionicons name="shuffle" size={26} color={isShuffle ? '#1DB954' : '#B3B3B3'} />
              {isShuffle && <View style={styles.dot} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={skipToPrevious} hitSlop={8}>
              <Ionicons name="play-skip-back" size={36} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
              {isBuffering && isPlaying ? (
                <Ionicons name="ellipsis-horizontal" size={32} color="#000000" />
              ) : (
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#000000" style={{ marginLeft: isPlaying ? 0 : 3 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={skipToNext} hitSlop={8}>
              <Ionicons name="play-skip-forward" size={36} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleRepeat} hitSlop={8}>
              <Ionicons
                name={repeatMode === 'one' ? 'repeat' : 'repeat'}
                size={26}
                color={repeatMode === 'off' ? '#B3B3B3' : '#1DB954'}
              />
              {repeatMode === 'one' && <Text style={styles.repeatOne}>1</Text>}
              {repeatMode !== 'off' && <View style={styles.dot} />}
            </TouchableOpacity>
          </View>

          <View style={styles.accessories}>
            <TouchableOpacity onPress={() => setSleepOpen(true)} style={styles.accessory}>
              <Ionicons name="moon-outline" size={20} color={sleepTimerTimeLeft !== null || sleepAtEndOfTrack ? '#1DB954' : '#B3B3B3'} />
              {sleepTimerTimeLeft !== null && <Text style={styles.accessoryText}>{formatCountdown(sleepTimerTimeLeft)}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSpeedOpen(true)} style={styles.accessory}>
              <Ionicons name="speedometer-outline" size={20} color={playbackRate !== 1 ? '#1DB954' : '#B3B3B3'} />
              {playbackRate !== 1 && <Text style={styles.accessoryText}>{playbackRate}x</Text>}
            </TouchableOpacity>
            <View style={styles.accessory}>
              <Ionicons
                name={downloading ? 'cloud-download-outline' : saved ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                size={22}
                color={saved || downloading ? '#1DB954' : '#B3B3B3'}
              />
              {downloading && <Text style={styles.accessoryText}>{Math.round((progress[currentTrack.id] ?? 0) * 100)}%</Text>}
            </View>
            <TouchableOpacity onPress={() => setLyricsOpen(true)} style={styles.accessory}>
              <Ionicons name="chatbox-ellipses-outline" size={20} color="#B3B3B3" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setQueueOpen(true)} style={styles.accessory}>
              <Ionicons name="list-outline" size={22} color="#B3B3B3" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <SleepTimerModal visible={sleepOpen} onClose={() => setSleepOpen(false)} />
        <QueueModal visible={queueOpen} onClose={() => setQueueOpen(false)} />
        <LyricsModal visible={lyricsOpen} onClose={() => setLyricsOpen(false)} />
        <TrackMenuModal visible={menuOpen} track={currentTrack} onClose={() => setMenuOpen(false)} onNavigate={onClose} />

        <Modal visible={speedOpen} transparent animationType="fade" onRequestClose={() => setSpeedOpen(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSpeedOpen(false)}>
            <View style={styles.speedCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.speedTitle}>Playback speed</Text>
              {RATES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={styles.speedOption}
                  onPress={() => {
                    setPlaybackRate(r);
                    setSpeedOpen(false);
                  }}
                >
                  <Text style={[styles.speedText, r === playbackRate && { color: '#1DB954', fontWeight: 'bold' }]}>
                    {r === 1 ? 'Normal' : `${r}x`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 56 },
  headerBtn: { padding: 6 },
  headerLabel: { color: '#B3B3B3', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5 },
  headerSub: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold', maxWidth: width - 140 },
  artworkWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  artwork: {
    width: width - 64,
    height: width - 64,
    borderRadius: 8,
    backgroundColor: '#282828',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, marginBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  artist: { color: '#B3B3B3', fontSize: 15 },
  seekWrap: { paddingHorizontal: 32, marginBottom: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, marginBottom: 28 },
  playBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  dot: { alignSelf: 'center', width: 4, height: 4, borderRadius: 2, backgroundColor: '#1DB954', marginTop: 3 },
  repeatOne: { position: 'absolute', top: 7, left: 0, right: 0, textAlign: 'center', color: '#1DB954', fontSize: 9, fontWeight: 'bold' },
  accessories: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 28 },
  accessory: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 40, justifyContent: 'center' },
  accessoryText: { color: '#1DB954', fontSize: 11, fontWeight: 'bold' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  speedCard: { backgroundColor: '#282828', borderRadius: 14, width: '100%', maxWidth: 300, padding: 16 },
  speedTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  speedOption: { paddingVertical: 12, alignItems: 'center' },
  speedText: { color: '#FFFFFF', fontSize: 15 },
});
