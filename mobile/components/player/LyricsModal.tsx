import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudio } from '../../context/AudioContext';
import { usePlaybackProgress } from '../../context/playbackProgress';
import { cached } from '../../services/musicApi/cache';
import { fetchWithTimeout } from '../../services/musicApi/http';
import { primaryArtistName } from '../../services/musicApi';

interface LyricLine {
  time: number;
  text: string;
}

interface Lyrics {
  synced: LyricLine[];
  plain: string | null;
}

const MONTH = 30 * 24 * 3_600_000;

function parseLRC(lrc: string): LyricLine[] {
  const re = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  const out: LyricLine[] = [];
  for (const line of lrc.split('\n')) {
    const m = re.exec(line);
    if (!m) continue;
    const ms = parseInt(m[3], 10) * (m[3].length === 2 ? 10 : 1);
    out.push({ time: parseInt(m[1], 10) * 60000 + parseInt(m[2], 10) * 1000 + ms, text: line.replace(re, '').trim() });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Lyrics are cached, so songs you have already opened show lyrics offline too. */
async function loadLyrics(trackId: string, name: string, artist: string): Promise<Lyrics> {
  return cached<Lyrics>(`lyrics:${trackId}`, MONTH, async () => {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(`${name} ${artist}`)}`;
    const res = await fetchWithTimeout(url, 10_000);
    if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
    const data = (await res.json()) as { syncedLyrics?: string; plainLyrics?: string }[];
    const match = data?.[0];
    return {
      synced: match?.syncedLyrics ? parseLRC(match.syncedLyrics) : [],
      plain: match?.plainLyrics ?? null,
    };
  });
}

function SyncedLyrics({ lines, visible }: { lines: LyricLine[]; visible: boolean }) {
  const { position } = usePlaybackProgress();
  const listRef = useRef<FlatList<LyricLine>>(null);
  const active = lines.findIndex((l, i) => position >= l.time && (!lines[i + 1] || position < lines[i + 1].time));

  useEffect(() => {
    if (visible && active >= 0) {
      try {
        listRef.current?.scrollToIndex({ index: active, animated: true, viewPosition: 0.3 });
      } catch {
        // list not measured yet
      }
    }
  }, [active, visible]);

  return (
    <FlatList
      ref={listRef}
      data={lines}
      keyExtractor={(item, i) => `${item.time}-${i}`}
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 120 }}
      showsVerticalScrollIndicator={false}
      getItemLayout={(_, index) => ({ length: 54, offset: 54 * index, index })}
      onScrollToIndexFailed={() => {}}
      renderItem={({ item, index }) => (
        <Text style={[styles.line, index === active && styles.lineActive, index < active && styles.linePassed]}>
          {item.text || '♪'}
        </Text>
      )}
    />
  );
}

export default function LyricsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { currentTrack } = useAudio();
  const [loading, setLoading] = useState(false);
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible || !currentTrack) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setLyrics(null);
    loadLyrics(currentTrack.id, currentTrack.name, primaryArtistName(currentTrack))
      .then((l) => !cancelled && setLyrics(l))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, currentTrack]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lyrics</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1DB954" />
          </View>
        ) : lyrics && lyrics.synced.length > 0 ? (
          <SyncedLyrics lines={lyrics.synced} visible={visible} />
        ) : lyrics?.plain ? (
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <Text style={styles.plain}>{lyrics.plain}</Text>
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <Ionicons name="sad-outline" size={48} color="#535353" />
            <Text style={styles.empty}>
              {failed ? 'Lyrics need an internet connection the first time.' : 'No lyrics found for this song.'}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 56 },
  headerBtn: { padding: 6 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  empty: { color: '#B3B3B3', fontSize: 14, textAlign: 'center' },
  plain: { color: '#FFFFFF', fontSize: 16, lineHeight: 28, textAlign: 'center', fontWeight: '500' },
  line: { color: 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: 'bold', lineHeight: 28, paddingVertical: 12, textAlign: 'center' },
  lineActive: { color: '#1DB954', fontSize: 22, lineHeight: 28 },
  linePassed: { color: 'rgba(255,255,255,0.2)' },
});
