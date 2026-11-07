/**
 * Raga Extension - Background Service Worker
 * Manages offscreen audio lifecycle, global keyboard commands, and badge status.
 */

import { recordTrackPlay } from './api.js';

let creatingOffscreenPromise = null;

export async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }
  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }
  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Background audio streaming playback for Raga'
  });
  await creatingOffscreenPromise;
  creatingOffscreenPromise = null;
}

// Forward commands safely to offscreen document
async function sendToOffscreen(action, payload = {}) {
  await ensureOffscreenDocument();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ target: 'offscreen', action, payload }, (res) => {
      if (chrome.runtime.lastError) {
        // Retry once if offscreen was freshly created
        setTimeout(() => {
          chrome.runtime.sendMessage({ target: 'offscreen', action, payload }, (retryRes) => {
            resolve(retryRes);
          });
        }, 150);
      } else {
        resolve(res);
      }
    });
  });
}

// Listen to messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload, action, target } = message;

  // Actions explicitly targeted for the service worker
  if (target === 'background') {
    if (action === 'ENSURE_OFFSCREEN') {
      ensureOffscreenDocument().then(() => sendResponse({ success: true }));
      return true;
    }
    if (action === 'GET_INITIAL_STATE') {
      chrome.storage.local.get(['volume', 'isShuffle', 'isRepeat', 'currentTrack', 'queue', 'currentIndex'], (data) => {
        sendResponse(data || {});
      });
      return true;
    }
    return false;
  }

  // Handle offscreen state sync to local storage
  if (type === 'OFFSCREEN_STATE_SYNC' && payload) {
    chrome.storage.local.set(payload);
  }

  // Handle broadcast status updates from offscreen audio
  if (type === 'PLAY_STATE_CHANGE') {
    if (payload.isPlaying) {
      chrome.action.setBadgeText({ text: '▶' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }

  if (type === 'TRACK_CHANGED' && payload.track) {
    chrome.action.setTitle({
      title: `Raga: ${payload.track.name} - ${payload.track.artist}`
    });
    chrome.action.setBadgeText({ text: '▶' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });

    // Record to recently played tracks
    recordTrackPlay(payload.track);
  }

  return false;
});

// Global keyboard shortcuts (commands)
chrome.commands.onCommand.addListener(async (command) => {
  await ensureOffscreenDocument();
  if (command === 'play_pause') {
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'TOGGLE_PLAY' });
  } else if (command === 'next_track') {
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'SKIP_NEXT' });
  } else if (command === 'prev_track') {
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'SKIP_PREV' });
  }
});

// Extension install / startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Raga Background] Extension installed.');
  ensureOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Raga Background] Browser started.');
  ensureOffscreenDocument();
});
