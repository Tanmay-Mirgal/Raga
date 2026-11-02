import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearApiCache } from '../../../services/musicApi';
import { clearOffline, enforceCacheLimit, formatBytes, useOffline } from '../../../utils/offline';
import { useSettings, type Settings } from '../../../utils/settings';

const QUALITY: { value: Settings['streamQuality']; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low · 96k' },
  { value: 'normal', label: 'Normal · 160k' },
  { value: 'high', label: 'High · 320k' },
];
const CACHE_SIZES = [250, 500, 1000, 2000];

function Row({ title, subtitle, right }: { title: string; subtitle?: string; right: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

function Chips<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <TouchableOpacity key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.chip, o.value === value && styles.chipActive]}>
          <Text style={[styles.chipText, o.value === value && styles.chipTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [settings, update] = useSettings();
  const { usage } = useOffline();

  const confirm = (title: string, message: string, action: () => void) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: action },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        <Text style={styles.section}>Playback</Text>
        <Row title="Streaming quality" subtitle="Auto uses 320k on Wi-Fi and 160k on mobile data" right={null} />
        <View style={{ paddingHorizontal: 16 }}>
          <Chips options={QUALITY} value={settings.streamQuality} onChange={(streamQuality) => update({ streamQuality })} />
        </View>
        <Row
          title="Autoplay"
          subtitle="Keep playing similar songs when your queue ends"
          right={<Switch value={settings.autoplay} onValueChange={(autoplay) => update({ autoplay })} trackColor={{ true: '#1DB954' }} />}
        />

        <Text style={styles.section}>Offline</Text>
        <Row
          title="Offline mode"
          subtitle="Only play songs saved on this device"
          right={<Switch value={settings.offlineMode} onValueChange={(offlineMode) => update({ offlineMode })} trackColor={{ true: '#1DB954' }} />}
        />
        <Row
          title="Save songs as you listen"
          subtitle="Every song you play is kept so it replays without internet"
          right={<Switch value={settings.autoCache} onValueChange={(autoCache) => update({ autoCache })} trackColor={{ true: '#1DB954' }} />}
        />
        <Row
          title="Use mobile data for downloads"
          subtitle="Otherwise downloads and auto-saving wait for Wi-Fi"
          right={
            <Switch
              value={settings.useCellularForOffline}
              onValueChange={(useCellularForOffline) => update({ useCellularForOffline })}
              trackColor={{ true: '#1DB954' }}
            />
          }
        />
        <Row title="Download quality" right={null} />
        <View style={{ paddingHorizontal: 16 }}>
          <Chips
            options={[
              { value: 'normal' as const, label: 'Normal · 160k' },
              { value: 'high' as const, label: 'High · 320k' },
            ]}
            value={settings.downloadQuality}
            onChange={(downloadQuality) => update({ downloadQuality })}
          />
        </View>
        <Row title="Auto-saved songs limit" subtitle="Oldest played songs are removed first" right={null} />
        <View style={{ paddingHorizontal: 16 }}>
          <Chips
            options={CACHE_SIZES.map((mb) => ({ value: mb, label: mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB` }))}
            value={settings.cacheLimitMB}
            onChange={(cacheLimitMB) => {
              update({ cacheLimitMB });
              setTimeout(() => void enforceCacheLimit(), 0);
            }}
          />
        </View>

        <Text style={styles.section}>Storage</Text>
        <Row title="Downloads" subtitle={`${usage.downloadCount} songs · ${formatBytes(usage.downloadBytes)}`} right={null} />
        <Row title="Auto-saved songs" subtitle={`${usage.cacheCount} songs · ${formatBytes(usage.cacheBytes)}`} right={null} />
        <TouchableOpacity
          style={styles.action}
          onPress={() => confirm('Clear auto-saved songs?', 'Downloads are kept.', () => void clearOffline('cache'))}
        >
          <Text style={styles.actionText}>Clear auto-saved songs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.action}
          onPress={() => confirm('Remove all downloads?', 'They will need internet to play again.', () => void clearOffline('download'))}
        >
          <Text style={[styles.actionText, { color: '#FF5252' }]}>Remove all downloads</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => void clearApiCache().then(() => Alert.alert('Done', 'Browsing cache cleared.'))}>
          <Text style={styles.actionText}>Clear browsing cache</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginLeft: 4 },
  section: { color: '#1DB954', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, marginTop: 24, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  rowTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  rowSub: { color: '#B3B3B3', fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#282828' },
  chipActive: { backgroundColor: '#1DB954' },
  chipText: { color: '#FFFFFF', fontSize: 13 },
  chipTextActive: { color: '#000000', fontWeight: 'bold' },
  action: { paddingHorizontal: 16, paddingVertical: 14 },
  actionText: { color: '#FFFFFF', fontSize: 15 },
});
