import TrackPlayer, { Event } from 'react-native-track-player';
import { skipNext, skipPrevious } from './playerControls';

/**
 * Runs as a headless task, so the notification, lock screen, headset and
 * Bluetooth/car buttons keep working while the app is in the background.
 * Registered in index.js (it must be registered at app start-up).
 */
export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => skipNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => skipPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => TrackPlayer.seekTo(e.position));
  TrackPlayer.addEventListener(Event.RemoteJumpForward, (e) => TrackPlayer.seekBy(e.interval));
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, (e) => TrackPlayer.seekBy(-e.interval));
}
