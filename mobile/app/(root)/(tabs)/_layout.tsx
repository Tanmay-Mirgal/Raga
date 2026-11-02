import { Tabs } from 'expo-router';
import { StatusBar, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudio } from '../../../context/AudioContext';
import MiniPlayer from '../../../components/player/MiniPlayer';
import FullPlayer from '../../../components/player/FullPlayer';
import OfflineBanner from '../../../components/OfflineBanner';
import { colors } from '../../../theme';

const TAB_HEIGHT = 58;

function TabIcon({ name, focusedName, focused, color }: { name: keyof typeof Ionicons.glyphMap; focusedName: keyof typeof Ionicons.glyphMap; focused: boolean; color: string }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Ionicons name={focused ? focusedName : name} size={22} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const { currentTrack } = useAudio();
  const insets = useSafeAreaInsets();
  const [playerOpen, setPlayerOpen] = useState(false);
  const bottomInset = Math.max(insets.bottom, 6);
  const barHeight = TAB_HEIGHT + bottomInset;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" />

      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: {
            backgroundColor: 'rgba(10,10,15,0.98)',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            paddingTop: 6,
            paddingBottom: bottomInset,
            height: barHeight,
            elevation: 0,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => <TabIcon name="home-outline" focusedName="home" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, focused }) => <TabIcon name="search-outline" focusedName="search" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen
          name="playlists"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, focused }) => <TabIcon name="library-outline" focusedName="library" focused={focused} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => <TabIcon name="person-outline" focusedName="person" focused={focused} color={color} />,
          }}
        />

        {/* Detail pages: reachable by navigation, hidden from the tab bar. */}
        <Tabs.Screen name="album/[id]" options={{ href: null }} />
        <Tabs.Screen name="artist/[id]" options={{ href: null }} />
        <Tabs.Screen name="playlist/[id]" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>

      {currentTrack && <MiniPlayer bottom={barHeight + 8} onOpen={() => setPlayerOpen(true)} />}
      <FullPlayer visible={playerOpen && !!currentTrack} onClose={() => setPlayerOpen(false)} />
      <OfflineBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  iconPill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconPillActive: { backgroundColor: colors.accentSoft },
});
