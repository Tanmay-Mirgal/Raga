import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { allArtistNames, pickImage, type HomeSection, type Track } from '../services/musicApi';
import { CoverCard } from './CoverCard';
import { MemoizedAlbumCard } from './MemoizedAlbumCard';

interface Props {
  sections: HomeSection[];
  onPlaySong: (song: Track, list: Track[]) => void;
  onSongMenu: (song: Track) => void;
}

/** Renders Spotify-style shelves: songs, albums, artists (round) and playlists. */
export default function HomeSections({ sections, onPlaySong, onSongMenu }: Props) {
  const router = useRouter();
  const go = (path: string) => router.push(path as any);

  return (
    <>
      {sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.header}>{section.title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {section.type === 'songs' &&
              section.items.map((song) => (
                <MemoizedAlbumCard
                  key={song.id}
                  id={song.id}
                  name={song.name}
                  artist={allArtistNames(song)}
                  imageUrl={pickImage(song.image, 'lg') ?? ''}
                  onPress={() => onPlaySong(song, section.items)}
                  onMenuPress={() => onSongMenu(song)}
                />
              ))}
            {section.type === 'albums' &&
              section.items.map((album) => (
                <CoverCard
                  key={album.id}
                  title={album.name}
                  subtitle={[album.year, album.artists[0]?.name].filter(Boolean).join(' · ')}
                  imageUrl={pickImage(album.image, 'lg')}
                  onPress={() => go(`/album/${album.id}`)}
                />
              ))}
            {section.type === 'artists' &&
              section.items.map((artist) => (
                <CoverCard
                  key={artist.id}
                  round
                  title={artist.name}
                  subtitle="Artist"
                  imageUrl={pickImage(artist.image, 'lg')}
                  onPress={() => go(`/artist/${artist.id}?name=${encodeURIComponent(artist.name)}`)}
                />
              ))}
            {section.type === 'playlists' &&
              section.items.map((playlist) => (
                <CoverCard
                  key={playlist.id}
                  title={playlist.name}
                  subtitle={playlist.songCount ? `${playlist.songCount} songs` : 'Playlist'}
                  imageUrl={pickImage(playlist.image, 'lg')}
                  onPress={() => go(`/playlist/${playlist.id}`)}
                />
              ))}
          </ScrollView>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  header: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 12 },
  row: { paddingHorizontal: 16 },
});
