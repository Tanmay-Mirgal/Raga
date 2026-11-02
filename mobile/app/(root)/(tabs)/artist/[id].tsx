import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverCard } from '../../../../components/CoverCard';
import { MemoizedTrackRow } from '../../../../components/MemoizedTrackRow';
import TrackMenuModal from '../../../../components/TrackMenuModal';
import { useAudio } from '../../../../context/AudioContext';
import { allArtistNames, getArtist, pickImage, type ArtistDetail, type Track } from '../../../../services/musicApi';
import { formatCount } from '../../../../utils/format';

export default function ArtistScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playTrack, currentTrack, isPlaying, isShuffle, toggleShuffle } = useAudio();

  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    getArtist(String(id), name ? String(name) : undefined)
      .then(setArtist)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [id, name]);

  useEffect(() => {
    setArtist(null);
    setShowAllSongs(false);
    setBioOpen(false);
    load();
  }, [load]);

  const songs = artist?.topSongs ?? [];
  const visibleSongs = showAllSongs ? songs : songs.slice(0, 5);
  const go = (path: string) => router.push(path as any);

  const play = async (shuffle: boolean) => {
    if (songs.length === 0) return;
    if (shuffle !== isShuffle) await toggleShuffle();
    await playTrack(shuffle ? songs[Math.floor(Math.random() * songs.length)] : songs[0], songs);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#3A3A4D', '#0A0A0F']} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {artist?.image?.length ? (
            <Image source={{ uri: pickImage(artist.image, 'lg') }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person" size={64} color="#535353" />
            </View>
          )}
        </LinearGradient>

        <View style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.name}>{artist?.name ?? ''}</Text>
            {artist?.isVerified && <Ionicons name="checkmark-circle" size={20} color="#3D91F4" />}
          </View>
          {!!artist?.followerCount && <Text style={styles.followers}>{formatCount(artist.followerCount)} followers</Text>}
          <View style={styles.actions}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => play(true)} hitSlop={8} style={{ marginRight: 20 }} disabled={songs.length === 0}>
              <Ionicons name="shuffle" size={30} color="#1DB954" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => play(false)} style={styles.playBtn} disabled={songs.length === 0}>
              <Ionicons name="play" size={28} color="#000" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
        </View>

        {loading && !artist && <ActivityIndicator color="#1DB954" style={{ marginTop: 32 }} />}
        {failed && !artist && !loading && (
          <View style={styles.failed}>
            <Ionicons name="cloud-offline-outline" size={40} color="#535353" />
            <Text style={{ color: '#B3B3B3', textAlign: 'center' }}>Could not load this artist. Check your connection.</Text>
            <TouchableOpacity onPress={load} style={styles.retry}>
              <Text style={{ color: '#000', fontWeight: 'bold' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {songs.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.sectionTitle}>Popular</Text>
            <View style={{ paddingHorizontal: 16 }}>
              {visibleSongs.map((song) => (
                <MemoizedTrackRow
                  key={song.id}
                  id={song.id}
                  name={song.name}
                  artist={allArtistNames(song)}
                  imageUrl={pickImage(song.image, 'md')}
                  isCurrent={currentTrack?.id === song.id}
                  isPlaying={isPlaying}
                  onPress={() => playTrack(song, songs)}
                  onMenuPress={() => setMenuTrack(song)}
                />
              ))}
            </View>
            {songs.length > 5 && (
              <TouchableOpacity onPress={() => setShowAllSongs((v) => !v)} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={styles.seeAll}>{showAllSongs ? 'Show less' : 'See more'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {(artist?.topAlbums.length ?? 0) > 0 && (
          <Shelf title="Albums">
            {artist!.topAlbums.map((a) => (
              <CoverCard key={a.id} title={a.name} subtitle={a.year} imageUrl={pickImage(a.image, 'lg')} onPress={() => go(`/album/${a.id}`)} />
            ))}
          </Shelf>
        )}
        {(artist?.singles.length ?? 0) > 0 && (
          <Shelf title="Singles & EPs">
            {artist!.singles.map((a) => (
              <CoverCard key={a.id} title={a.name} subtitle={a.year} imageUrl={pickImage(a.image, 'lg')} onPress={() => go(`/album/${a.id}`)} />
            ))}
          </Shelf>
        )}
        {(artist?.similar.length ?? 0) > 0 && (
          <Shelf title="Fans also like">
            {artist!.similar.map((a) => (
              <CoverCard key={a.id} round title={a.name} subtitle="Artist" imageUrl={pickImage(a.image, 'lg')} onPress={() => go(`/artist/${a.id}?name=${encodeURIComponent(a.name)}`)} />
            ))}
          </Shelf>
        )}

        {!!artist?.bio && (
          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: 0 }]}>About</Text>
            <Text style={styles.bio} numberOfLines={bioOpen ? undefined : 5}>
              {artist.bio}
            </Text>
            <TouchableOpacity onPress={() => setBioOpen((v) => !v)}>
              <Text style={styles.seeAll}>{bioOpen ? 'Show less' : 'Read more'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <TrackMenuModal visible={!!menuTrack} track={menuTrack} onClose={() => setMenuTrack(null)} />
    </View>
  );
}

function Shelf({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 20 },
  back: { alignSelf: 'flex-start', padding: 8, marginLeft: 4 },
  avatar: { width: 180, height: 180, borderRadius: 90, backgroundColor: '#282828', marginTop: 4 },
  info: { paddingHorizontal: 16 },
  name: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', flexShrink: 1 },
  followers: { color: '#B3B3B3', fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 12 },
  seeAll: { color: '#B3B3B3', fontSize: 13, fontWeight: 'bold', marginTop: 6 },
  bio: { color: '#B3B3B3', fontSize: 14, lineHeight: 21 },
  failed: { alignItems: 'center', padding: 32, gap: 12 },
  retry: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1DB954' },
});
