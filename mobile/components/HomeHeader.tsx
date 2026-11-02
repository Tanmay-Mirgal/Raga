import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, type } from '../theme';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function HomeHeader({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: insets.top + 14 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.caption}>{greeting()}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings' as any)} hitSlop={8}>
        <Ionicons name="settings-outline" size={20} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/profile' as any)} hitSlop={8}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Ionicons name="person" size={18} color={colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  caption: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  name: { ...type.title, color: colors.text, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.accent },
  avatarEmpty: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', borderColor: colors.border },
});
