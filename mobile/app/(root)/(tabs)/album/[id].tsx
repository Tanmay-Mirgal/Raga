import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import CollectionView from '../../../../components/CollectionView';
import { getAlbum, pickImage, type AlbumDetail } from '../../../../services/musicApi';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    getAlbum(String(id))
      .then(setAlbum)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setAlbum(null);
    load();
  }, [load]);

  return (
    <CollectionView
      title={album?.name ?? ''}
      subtitle={album ? [album.artists.map((a) => a.name).slice(0, 2).join(', '), album.year].filter(Boolean).join(' · ') : undefined}
      description={album?.description}
      imageUrl={pickImage(album?.image, 'lg')}
      tracks={album?.songs ?? []}
      loading={loading}
      failed={failed}
      onRetry={load}
    />
  );
}
