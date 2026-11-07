import { getSuggestions } from './api.js';

const audio = document.getElementById('raga-audio-engine') || new Audio();

let currentTrack = null;
let queue = [];
let currentIndex = -1;
let isShuffle = false;
let isRepeat = false;
let volume = 0.8;

// Request initial state from background service worker (since offscreen docs have no chrome.storage access)
chrome.runtime.sendMessage({ target: 'background', action: 'GET_INITIAL_STATE' }, (data) => {
  if (chrome.runtime.lastError || !data) return;
  if (typeof data.volume === 'number') {
    volume = data.volume;
    audio.volume = volume;
  } else {
    audio.volume = 0.8;
  }
  if (typeof data.isShuffle === 'boolean') isShuffle = data.isShuffle;
  if (typeof data.isRepeat === 'boolean') isRepeat = data.isRepeat;
  if (data.currentTrack) currentTrack = data.currentTrack;
  if (Array.isArray(data.queue)) queue = data.queue;
  if (typeof data.currentIndex === 'number') currentIndex = data.currentIndex;
});

function notifyStateSync() {
  chrome.runtime.sendMessage({
    type: 'OFFSCREEN_STATE_SYNC',
    payload: {
      currentTrack,
      queue,
      currentIndex,
      isShuffle,
      isRepeat,
      volume,
      isPlaying: !audio.paused && !audio.ended && audio.currentTime > 0
    }
  }).catch(() => {});
}

function broadcast(type, payload = {}) {
  chrome.runtime.sendMessage({
    type,
    payload: {
      ...payload,
      currentTrack,
      isPlaying: !audio.paused && !audio.ended,
      currentTime: audio.currentTime || 0,
      duration: audio.duration || currentTrack?.duration || 0,
      volume: audio.volume,
      queue,
      currentIndex,
      isShuffle,
      isRepeat
    }
  }).catch(() => {
    // Popup might be closed, completely normal in Chrome extensions
  });
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator) || !track) return;

  const artwork = track.imageUrl ? [
    { src: track.imageUrl, sizes: '96x96', type: 'image/png' },
    { src: track.imageUrl, sizes: '128x128', type: 'image/png' },
    { src: track.imageUrl, sizes: '256x256', type: 'image/png' },
    { src: track.imageUrl, sizes: '512x512', type: 'image/png' }
  ] : [];

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name || 'Unknown Track',
    artist: track.artist || 'Raga Music',
    album: track.album || '',
    artwork
  });

  navigator.mediaSession.setActionHandler('play', () => resumeAudio());
  navigator.mediaSession.setActionHandler('pause', () => pauseAudio());
  navigator.mediaSession.setActionHandler('previoustrack', () => skipPrevious());
  navigator.mediaSession.setActionHandler('nexttrack', () => skipNext());
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) {
      audio.currentTime = details.seekTime;
      broadcast('TIME_UPDATE', { currentTime: audio.currentTime });
    }
  });
}

// Audio Engine Events
audio.addEventListener('play', () => {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  notifyStateSync();
  broadcast('PLAY_STATE_CHANGE', { isPlaying: true });
});

audio.addEventListener('pause', () => {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  notifyStateSync();
  broadcast('PLAY_STATE_CHANGE', { isPlaying: false });
});

audio.addEventListener('timeupdate', () => {
  broadcast('TIME_UPDATE', {
    currentTime: audio.currentTime,
    duration: audio.duration || currentTrack?.duration || 0
  });
});

audio.addEventListener('durationchange', () => {
  broadcast('DURATION_CHANGE', {
    duration: audio.duration
  });
});

audio.addEventListener('ended', async () => {
  if (isRepeat) {
    audio.currentTime = 0;
    audio.play().catch(console.error);
    return;
  }
  await skipNext();
});

audio.addEventListener('error', (e) => {
  console.warn('[Raga Offscreen] Audio element error:', e);
  broadcast('AUDIO_ERROR', { error: 'Failed to stream audio file' });
});

// Playback Operations
async function playTrack(track, newQueue = null, index = null) {
  if (!track || !track.streamUrl) return;

  if (newQueue && Array.isArray(newQueue)) {
    queue = newQueue;
    currentIndex = (index != null && index >= 0) ? index : queue.findIndex(t => t.id === track.id);
    if (currentIndex === -1) {
      queue.unshift(track);
      currentIndex = 0;
    }
  } else if (!queue.some(t => t.id === track.id)) {
    queue.push(track);
    currentIndex = queue.length - 1;
  } else if (index != null && index >= 0) {
    currentIndex = index;
  }

  currentTrack = track;
  audio.src = track.streamUrl;
  audio.currentTime = 0;

  try {
    await audio.play();
  } catch (err) {
    console.error('[Raga Offscreen] audio.play error:', err);
  }

  updateMediaSession(track);
  notifyStateSync();
  broadcast('TRACK_CHANGED', { track });
}

function pauseAudio() {
  audio.pause();
  broadcast('PLAY_STATE_CHANGE', { isPlaying: false });
}

function resumeAudio() {
  if (!audio.src && currentTrack?.streamUrl) {
    audio.src = currentTrack.streamUrl;
  }
  audio.play().catch(console.error);
  broadcast('PLAY_STATE_CHANGE', { isPlaying: true });
}

function togglePlay() {
  if (audio.paused || audio.ended) {
    resumeAudio();
  } else {
    pauseAudio();
  }
}

function seekTo(timeSeconds) {
  if (isNaN(timeSeconds)) return;
  audio.currentTime = Math.max(0, Math.min(timeSeconds, audio.duration || 99999));
  broadcast('TIME_UPDATE', { currentTime: audio.currentTime });
}

function setVolume(val) {
  const clamped = Math.max(0, Math.min(1, val));
  volume = clamped;
  audio.volume = clamped;
  notifyStateSync();
  broadcast('VOLUME_CHANGED', { volume: clamped });
}

async function skipNext() {
  if (queue.length === 0) return;

  if (isShuffle && queue.length > 1) {
    let nextIdx = Math.floor(Math.random() * queue.length);
    if (nextIdx === currentIndex) nextIdx = (currentIndex + 1) % queue.length;
    currentIndex = nextIdx;
    await playTrack(queue[currentIndex], queue, currentIndex);
    return;
  }

  if (currentIndex + 1 < queue.length) {
    currentIndex++;
    await playTrack(queue[currentIndex], queue, currentIndex);
  } else {
    // End of queue: try auto-playing suggestions
    try {
      const suggestions = await getSuggestions(currentTrack?.id, 10);
      if (suggestions && suggestions.length > 0) {
        queue = [...queue, ...suggestions];
        currentIndex++;
        await playTrack(queue[currentIndex], queue, currentIndex);
        return;
      }
    } catch (e) {}

    // Fallback: loop to beginning
    if (queue.length > 0) {
      currentIndex = 0;
      await playTrack(queue[0], queue, 0);
    }
  }
}

async function skipPrevious() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  if (queue.length === 0) return;

  if (currentIndex > 0) {
    currentIndex--;
    await playTrack(queue[currentIndex], queue, currentIndex);
  } else {
    currentIndex = queue.length - 1;
    await playTrack(queue[currentIndex], queue, currentIndex);
  }
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  notifyStateSync();
  broadcast('SHUFFLE_CHANGED', { isShuffle });
}

function toggleRepeat() {
  isRepeat = !isRepeat;
  notifyStateSync();
  broadcast('REPEAT_CHANGED', { isRepeat });
}

// Runtime Message Listener with target check
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;
  const { action, payload } = message;

  switch (action) {
    case 'PLAY_TRACK':
      playTrack(payload.track, payload.queue, payload.index);
      sendResponse({ success: true });
      break;

    case 'TOGGLE_PLAY':
      togglePlay();
      sendResponse({ success: true, isPlaying: !audio.paused });
      break;

    case 'PAUSE':
      pauseAudio();
      sendResponse({ success: true });
      break;

    case 'RESUME':
      resumeAudio();
      sendResponse({ success: true });
      break;

    case 'SEEK':
      seekTo(payload.time);
      sendResponse({ success: true });
      break;

    case 'SET_VOLUME':
      setVolume(payload.volume);
      sendResponse({ success: true });
      break;

    case 'SKIP_NEXT':
      skipNext();
      sendResponse({ success: true });
      break;

    case 'SKIP_PREV':
      skipPrevious();
      sendResponse({ success: true });
      break;

    case 'TOGGLE_SHUFFLE':
      toggleShuffle();
      sendResponse({ success: true, isShuffle });
      break;

    case 'TOGGLE_REPEAT':
      toggleRepeat();
      sendResponse({ success: true, isRepeat });
      break;

    case 'SET_QUEUE':
      queue = payload.queue || [];
      if (typeof payload.currentIndex === 'number') currentIndex = payload.currentIndex;
      notifyStateSync();
      broadcast('QUEUE_CHANGED', { queue, currentIndex });
      sendResponse({ success: true });
      break;

    case 'GET_STATE':
      sendResponse({
        currentTrack,
        isPlaying: !audio.paused && !audio.ended && audio.currentTime > 0,
        currentTime: audio.currentTime || 0,
        duration: audio.duration || currentTrack?.duration || 0,
        volume: audio.volume,
        queue,
        currentIndex,
        isShuffle,
        isRepeat
      });
      break;

    default:
      break;
  }
  return true;
});
