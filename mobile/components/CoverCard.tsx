import React, { memo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  /** Circular artwork, used for artists. */
  round?: boolean;
  size?: number;
  onPress: () => void;
}

function CoverCardBase({ title, subtitle, imageUrl, round, size = 140, onPress }: Props) {
  return (
    <TouchableOpacity style={[styles.card, { width: size }]} onPress={onPress} activeOpacity={0.8}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.art, { width: size, height: size, borderRadius: round ? size / 2 : 4 }]}
        />
      ) : (
        <View style={[styles.art, styles.placeholder, { width: size, height: size, borderRadius: round ? size / 2 : 4 }]}>
          <Ionicons name={round ? 'person' : 'musical-notes'} size={size / 3} color="#535353" />
        </View>
      )}
      <Text style={[styles.title, round && styles.centered]} numberOfLines={1}>
        {title}
      </Text>
      {!!subtitle && (
        <Text style={[styles.subtitle, round && styles.centered]} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export const CoverCard = memo(
  CoverCardBase,
  (a, b) => a.title === b.title && a.imageUrl === b.imageUrl && a.subtitle === b.subtitle && a.size === b.size
);

const styles = StyleSheet.create({
  card: { marginRight: 16 },
  art: { backgroundColor: '#282828', marginBottom: 8 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  subtitle: { color: '#B3B3B3', fontSize: 12 },
  centered: { textAlign: 'center' },
});
