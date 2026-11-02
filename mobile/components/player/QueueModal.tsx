import React from 'react';
import { FlatList, Image, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudio } from '../../context/AudioContext';
import { allArtistNames, pickImage } from '../../services/musicApi';

export default function QueueModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { queue, currentIndex, currentTrack, isShuffle, skipToQueueIndex, removeFromQueue, moveQueueItem } = useAudio();

  const upcoming = queue.map((track, index) => ({ track, index })).filter((x) => x.index > currentIndex);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Queue</Text>
          <View style={{ width: 40 }} />
        </View>

        {currentTrack && (
          <View style={styles.nowPlaying}>
            <Text style={styles.sectionLabel}>Now playing</Text>
            <View style={[styles.row, styles.rowActive]}>
              <Image source={{ uri: pickImage(currentTrack.image, 'sm') }} style={styles.thumb} />
              <View style={styles.meta}>
                <Text style={[styles.name, { color: '#1DB954' }]} numberOfLines={1}>
                  {currentTrack.name}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {allArtistNames(currentTrack)}
                </Text>
              </View>
              <Ionicons name="volume-high" size={20} color="#1DB954" style={{ marginRight: 12 }} />
            </View>
          </View>
        )}

        <Text style={[styles.sectionLabel, { paddingHorizontal: 16, marginTop: 12 }]}>
          Next up{isShuffle ? ' · shuffled' : ''}
        </Text>
        <FlatList
          data={upcoming}
          keyExtractor={(item) => `${item.track.id}-${item.index}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity style={styles.rowMain} onPress={() => skipToQueueIndex(item.index)}>
                <Image source={{ uri: pickImage(item.track.image, 'sm') }} style={styles.thumb} />
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.track.name}
                  </Text>
                  <Text style={styles.artist} numberOfLines={1}>
                    {allArtistNames(item.track)}
                  </Text>
                </View>
              </TouchableOpacity>
              {item.index > currentIndex + 1 && (
                <TouchableOpacity onPress={() => moveQueueItem(item.index, item.index - 1)} style={styles.action}>
                  <Ionicons name="chevron-up-outline" size={20} color="#B3B3B3" />
                </TouchableOpacity>
              )}
              {item.index < queue.length - 1 && (
                <TouchableOpacity onPress={() => moveQueueItem(item.index, item.index + 1)} style={styles.action}>
                  <Ionicons name="chevron-down-outline" size={20} color="#B3B3B3" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => removeFromQueue(item.index)} style={styles.action}>
                <Ionicons name="close" size={20} color="#FF5252" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={48} color="#535353" />
              <Text style={styles.emptyText}>Nothing queued. Use {'"Play next"'} or {'"Add to queue"'} on any song.</Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 56 },
  headerBtn: { padding: 6 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  nowPlaying: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  sectionLabel: { color: '#B3B3B3', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowActive: { backgroundColor: 'rgba(29,185,84,0.08)', borderRadius: 8, paddingHorizontal: 8 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 44, height: 44, borderRadius: 4, backgroundColor: '#282828' },
  meta: { flex: 1, marginLeft: 12, marginRight: 8 },
  name: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  artist: { color: '#B3B3B3', fontSize: 12, marginTop: 2 },
  action: { padding: 10 },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyText: { color: '#B3B3B3', fontSize: 14, textAlign: 'center' },
});
