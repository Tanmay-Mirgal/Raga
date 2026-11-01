import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../utils/network';
import { useSettings } from '../utils/settings';

/** Thin strip shown when the device is offline or Offline mode is on. */
export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { online } = useNetwork();
  const [settings] = useSettings();
  if (online && !settings.offlineMode) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { paddingTop: insets.top + 4 }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
      <Text style={styles.text}>
        {online ? 'Offline mode · playing saved songs only' : "You're offline · playing saved songs only"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 6,
    backgroundColor: 'rgba(40,40,40,0.96)',
  },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
