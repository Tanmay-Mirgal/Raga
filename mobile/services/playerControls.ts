import TrackPlayer, { RepeatMode } from 'react-native-track-player';

/**
 * Transport actions shared by the in-app UI and the background playback
 * service (notification, lock screen, headset and Bluetooth buttons), so
 * every entry point behaves identically.
 */

export async function skipNext() {
  try {
    await TrackPlayer.skipToNext();
  } catch {
    // Last track in the queue.
    if ((await TrackPlayer.getRepeatMode()) === RepeatMode.Queue) {
      await TrackPlayer.skip(0);
      await TrackPlayer.play();
    } else {
      await TrackPlayer.seekTo(0);
      await TrackPlayer.pause();
    }
  }
}

/** Like Spotify: past 3 seconds, "previous" restarts the song instead of going back. */
export async function skipPrevious() {
  const { position } = await TrackPlayer.getProgress();
  if (position > 3) {
    await TrackPlayer.seekTo(0);
    return;
  }
  try {
    await TrackPlayer.skipToPrevious();
  } catch {
    // First track in the queue.
    if ((await TrackPlayer.getRepeatMode()) === RepeatMode.Queue) {
      const queue = await TrackPlayer.getQueue();
      if (queue.length > 0) await TrackPlayer.skip(queue.length - 1);
    } else {
      await TrackPlayer.seekTo(0);
    }
  }
}
