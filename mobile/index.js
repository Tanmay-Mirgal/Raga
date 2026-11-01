import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './services/PlaybackService';

// Must happen at start-up, before any screen renders, so the background
// service (notification / lock screen / headset buttons) can find it.
TrackPlayer.registerPlaybackService(() => PlaybackService);

// eslint-disable-next-line import/first
import 'expo-router/entry';
