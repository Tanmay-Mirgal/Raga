import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import CollectionView from '../../../../components/CollectionView';
import { getPlaylist, pickImage, type PlaylistDetail } from '../../../../services/musicApi';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    getPlaylist(String(id))
      .then(setPlaylist)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setPlaylist(null);
    load();
  }, [load]);

  return (
    <CollectionView
      title={playlist?.name ?? ''}
      description={playlist?.description}
      imageUrl={pickImage(playlist?.image, 'lg')}
      tracks={playlist?.songs ?? []}
      loading={loading}
      failed={failed}
      onRetry={load}
      tint="#3B2A4D"
    />
  );
}
