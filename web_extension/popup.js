/**
 * Raga Extension - Popup Controller
 * Manages player controls, recently played list, search & discover, queue, and Full Player Modal.
 */

import { searchSongs, getTrendingSongs, getRecentlyPlayed, fetchLyrics } from './api.js';

// Elements - Navigation
const tabBtnHome = document.getElementById('tab-btn-home');
const tabBtnSearch = document.getElementById('tab-btn-search');
const tabBtnQueue = document.getElementById('tab-btn-queue');
const viewHome = document.getElementById('view-home');
const viewSearch = document.getElementById('view-search');
const viewQueue = document.getElementById('view-queue');
const queueBadgeCount = document.getElementById('queue-badge-count');

// Elements - Home & Recently Played
const recentList = document.getElementById('recent-list');
const recentEmpty = document.getElementById('recent-empty');
const btnClearRecent = document.getElementById('btn-clear-recent');
const homeTrendingList = document.getElementById('home-trending-list');

// Elements - Search
const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const genrePills = document.getElementById('genre-pills');
const searchStatusLabel = document.getElementById('search-status-label');
const searchCountLabel = document.getElementById('search-count-label');
const searchResultsList = document.getElementById('search-results-list');

// Elements - Queue
const queueList = document.getElementById('queue-list');
const btnClearQueue = document.getElementById('btn-clear-queue');

// Elements - Mini Player (Docked)
const btnOpenFullPlayer = document.getElementById('btn-open-full-player');
const playerArtWrap = document.getElementById('player-art-wrap');
const playerArt = document.getElementById('player-art');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const btnLike = document.getElementById('btn-like');

const progressBarWrap = document.getElementById('progress-bar-wrap');
const progressFill = document.getElementById('progress-fill');
const progressThumb = document.getElementById('progress-thumb');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');

const btnShuffle = document.getElementById('btn-shuffle');
const btnPrev = document.getElementById('btn-prev');
const btnPlayPause = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const btnNext = document.getElementById('btn-next');
const btnRepeat = document.getElementById('btn-repeat');

const btnMute = document.getElementById('btn-mute');
const iconVolHigh = document.getElementById('icon-vol-high');
const iconVolMuted = document.getElementById('icon-vol-muted');
const volSliderWrap = document.getElementById('vol-slider-wrap');
const volFill = document.getElementById('vol-fill');

// Elements - Full Player Modal
const fullPlayerModal = document.getElementById('full-player-modal');
const btnCloseFullPlayer = document.getElementById('btn-close-full-player');
const btnToggleLyrics = document.getElementById('btn-toggle-lyrics');
const fpArtContainer = document.getElementById('fp-art-container');
const fpArtwork = document.getElementById('fp-artwork');
const fpLyricsContainer = document.getElementById('fp-lyrics-container');
const fpLyricsContent = document.getElementById('fp-lyrics-content');
const fpTitle = document.getElementById('fp-title');
const fpArtist = document.getElementById('fp-artist');
const fpBtnLike = document.getElementById('fp-btn-like');

const fpProgressWrap = document.getElementById('fp-progress-wrap');
const fpProgressFill = document.getElementById('fp-progress-fill');
const fpProgressThumb = document.getElementById('fp-progress-thumb');
const fpTimeCurrent = document.getElementById('fp-time-current');
const fpTimeDuration = document.getElementById('fp-time-duration');

const fpBtnShuffle = document.getElementById('fp-btn-shuffle');
const fpBtnPrev = document.getElementById('fp-btn-prev');
const fpBtnPlayPause = document.getElementById('fp-btn-play-pause');
const fpIconPlay = document.getElementById('fp-icon-play');
const fpIconPause = document.getElementById('fp-icon-pause');
const fpBtnNext = document.getElementById('fp-btn-next');
const fpBtnRepeat = document.getElementById('fp-btn-repeat');

const fpBtnMute = document.getElementById('fp-btn-mute');
const fpVolWrap = document.getElementById('fp-vol-wrap');
const fpVolFill = document.getElementById('fp-vol-fill');

// Elements - Settings & Toast
const btnSettingsOpen = document.getElementById('btn-settings-open');
const settingsModal = document.getElementById('settings-modal');
const inputUserId = document.getElementById('input-user-id');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalClose = document.getElementById('btn-modal-close');
const btnModalSave = document.getElementById('btn-modal-save');
const toastMsg = document.getElementById('toast-msg');

// Local UI state
let state = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  queue: [],
  currentIndex: -1,
  isShuffle: false,
  isRepeat: false,
  likedTrackIds: new Set(),
  recentlyPlayed: []
};

let searchDebounceTimer = null;
let isSeeking = false;
let lastUnmutedVolume = 0.8;
let showLyrics = false;
let loadedLyricsTrackId = null;

// Time formatter
function formatTime(secs) {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Toast helper
function showToast(message) {
  toastMsg.textContent = message;
  toastMsg.classList.add('show');
  setTimeout(() => toastMsg.classList.remove('show'), 2000);
}

// Helper to send action to offscreen player
function sendPlayerAction(action, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ target: 'offscreen', action, payload }, (res) => {
      resolve(res);
    });
  });
}

// ─── Initialization ──────────────────────────────────────────────────────────

async function init() {
  setupEventListeners();
  loadLikedTracks();
  loadSettings();

  // Ensure offscreen document is ready
  chrome.runtime.sendMessage({ target: 'background', action: 'ENSURE_OFFSCREEN' });

  await refreshRecentlyPlayed();
  await syncPlayerState();
  loadInitialHomeContent();
}

async function syncPlayerState() {
  return new Promise((resolve) => {
    sendPlayerAction('GET_STATE').then((res) => {
      if (res) {
        state.currentTrack = res.currentTrack;
        state.isPlaying = !!res.isPlaying;
        state.currentTime = res.currentTime || 0;
        state.duration = res.duration || res.currentTrack?.duration || 0;
        state.volume = typeof res.volume === 'number' ? res.volume : 0.8;
        state.queue = Array.isArray(res.queue) ? res.queue : [];
        state.currentIndex = typeof res.currentIndex === 'number' ? res.currentIndex : -1;
        state.isShuffle = !!res.isShuffle;
        state.isRepeat = !!res.isRepeat;

        updatePlayerUI();
        updateQueueUI();
      }
      resolve();
    });
  });
}

function updatePlayerUI() {
  const track = state.currentTrack;

  if (track) {
    const title = track.name || 'Unknown Track';
    const artist = track.artist || 'Unknown Artist';
    const img = track.imageUrl || 'icons/icon-48.png';

    // Mini Player
    playerTitle.textContent = title;
    playerArtist.textContent = artist;
    playerArt.src = img;
    btnLike.classList.toggle('active', state.likedTrackIds.has(track.id));

    // Full Player Modal
    fpTitle.textContent = title;
    fpArtist.textContent = artist;
    fpArtwork.src = img;
    fpBtnLike.classList.toggle('active', state.likedTrackIds.has(track.id));

    if (showLyrics && loadedLyricsTrackId !== track.id) {
      loadLyricsForCurrentTrack();
    }
  } else {
    playerTitle.textContent = 'Welcome to Raga';
    playerArtist.textContent = 'Stream your favorite music';
    playerArt.src = 'icons/icon-48.png';
    btnLike.classList.remove('active');

    fpTitle.textContent = 'Welcome to Raga';
    fpArtist.textContent = 'Stream your favorite music';
    fpArtwork.src = 'icons/icon-128.png';
    fpBtnLike.classList.remove('active');
  }

  // Play / Pause Icon & Glow
  if (state.isPlaying) {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    fpIconPlay.style.display = 'none';
    fpIconPause.style.display = 'block';
    playerArtWrap.classList.add('playing');
  } else {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    fpIconPlay.style.display = 'block';
    fpIconPause.style.display = 'none';
    playerArtWrap.classList.remove('playing');
  }

  // Shuffle & Repeat indicators
  btnShuffle.classList.toggle('active', state.isShuffle);
  btnRepeat.classList.toggle('active', state.isRepeat);
  fpBtnShuffle.classList.toggle('active', state.isShuffle);
  fpBtnRepeat.classList.toggle('active', state.isRepeat);

  updateVolumeUI(state.volume);

  if (!isSeeking) {
    updateProgressUI(state.currentTime, state.duration);
  }

  queueBadgeCount.textContent = state.queue.length;

  markActiveTrackRows();
}

function updateProgressUI(currentTime, duration) {
  const currentFormatted = formatTime(currentTime);
  const durationFormatted = formatTime(duration);

  // Mini player
  timeCurrent.textContent = currentFormatted;
  timeDuration.textContent = durationFormatted;

  // Full player modal
  fpTimeCurrent.textContent = currentFormatted;
  fpTimeDuration.textContent = durationFormatted;

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const clamped = Math.min(100, Math.max(0, percent));

  progressFill.style.width = `${clamped}%`;
  progressThumb.style.left = `${clamped}%`;

  fpProgressFill.style.width = `${clamped}%`;
  fpProgressThumb.style.left = `${clamped}%`;
}

function updateVolumeUI(vol) {
  const percent = Math.min(100, Math.max(0, vol * 100));
  volFill.style.width = `${percent}%`;
  fpVolFill.style.width = `${percent}%`;

  if (vol === 0) {
    iconVolHigh.style.display = 'none';
    iconVolMuted.style.display = 'block';
  } else {
    iconVolHigh.style.display = 'block';
    iconVolMuted.style.display = 'none';
  }
}

// ─── Recently Played (Rendered as Clean Vertical List!) ───────────────────────

async function refreshRecentlyPlayed() {
  const recent = await getRecentlyPlayed();
  state.recentlyPlayed = recent;
  renderRecentlyPlayedList(recent);
}

function renderRecentlyPlayedList(tracks) {
  recentList.innerHTML = '';

  if (!tracks || tracks.length === 0) {
    recentEmpty.style.display = 'block';
    recentList.style.display = 'none';
    return;
  }

  recentEmpty.style.display = 'none';
  recentList.style.display = 'flex';

  renderTrackRows(recentList, tracks);
}

function markActiveTrackRows() {
  const currentId = state.currentTrack?.id;

  document.querySelectorAll('.track-item-row').forEach((row) => {
    const isThis = row.dataset.id === currentId;
    row.classList.toggle('is-playing', isThis && state.isPlaying);

    const waveMini = row.querySelector('.playing-wave-mini');
    if (isThis && state.isPlaying && !waveMini) {
      const b = document.createElement('div');
      b.className = 'playing-wave-mini';
      b.innerHTML = '<div class="w-bar"></div><div class="w-bar"></div><div class="w-bar"></div>';
      row.querySelector('.thumb-wrap').appendChild(b);
    } else if ((!isThis || !state.isPlaying) && waveMini) {
      waveMini.remove();
    }
  });
}

// ─── Home Initial Trending List ──────────────────────────────────────────────

async function loadInitialHomeContent() {
  homeTrendingList.innerHTML = `<div class="status-message">Loading top songs...</div>`;
  try {
    const songs = await getTrendingSongs();
    renderTrackRows(homeTrendingList, songs);
  } catch (err) {
    homeTrendingList.innerHTML = `<div class="status-message">Could not fetch recommendations.</div>`;
  }
}

// ─── Dedicated Search Experience ─────────────────────────────────────────────

async function executeSearch(query) {
  if (!query || !query.trim()) {
    btnClearSearch.classList.remove('visible');
    searchStatusLabel.textContent = 'Top Picks';
    searchCountLabel.textContent = '';
    searchResultsList.innerHTML = `<div class="status-message">Type above to search songs, artists, or genres.</div>`;
    return;
  }

  btnClearSearch.classList.add('visible');
  searchStatusLabel.textContent = `Results for "${query.trim()}"`;
  searchCountLabel.textContent = 'Searching...';
  searchResultsList.innerHTML = `<div class="status-message">Searching music library...</div>`;

  const results = await searchSongs(query.trim(), 20);

  if (!results || results.length === 0) {
    searchCountLabel.textContent = '0 songs';
    searchResultsList.innerHTML = `<div class="status-message">No songs found for "${query}". Try another search term!</div>`;
    return;
  }

  searchCountLabel.textContent = `${results.length} songs`;
  renderTrackRows(searchResultsList, results);
}

// Reusable track row renderer (for Recently Played, Search, Trending, Queue)
function renderTrackRows(container, tracks) {
  container.innerHTML = '';

  if (!tracks || tracks.length === 0) {
    container.innerHTML = `<div class="status-message">No songs available</div>`;
    return;
  }

  tracks.forEach((track, index) => {
    const isPlayingThis = state.isPlaying && state.currentTrack?.id === track.id;

    const row = document.createElement('div');
    row.className = `track-item-row ${isPlayingThis ? 'is-playing' : ''}`;
    row.dataset.id = track.id;

    row.innerHTML = `
      <div class="thumb-wrap">
        <img src="${track.imageUrl || 'icons/icon-48.png'}" alt="${track.name}" loading="lazy">
        <div class="play-overlay-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 19 12 7 20 7 4"></polygon></svg>
        </div>
        ${isPlayingThis ? `
          <div class="playing-wave-mini">
            <div class="w-bar"></div>
            <div class="w-bar"></div>
            <div class="w-bar"></div>
          </div>
        ` : ''}
      </div>
      <div class="title-col">
        <div class="track-name" title="${track.name}">${track.name}</div>
        <div class="artist-name" title="${track.artist}">${track.artist}</div>
      </div>
      <div class="side-meta">
        <span class="track-dur">${formatTime(track.duration)}</span>
        <button class="instant-play-btn" title="Play Track">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 19 12 7 20 7 4"></polygon></svg>
        </button>
      </div>
    `;

    row.addEventListener('click', () => {
      playSelectedTrack(track, tracks, index);
    });

    container.appendChild(row);
  });
}

// ─── Queue View ──────────────────────────────────────────────────────────────

function updateQueueUI() {
  queueList.innerHTML = '';

  if (!state.queue || state.queue.length === 0) {
    queueList.innerHTML = `<div class="status-message">Queue is empty. Play any song or album to populate!</div>`;
    return;
  }

  state.queue.forEach((track, index) => {
    const isCurrent = index === state.currentIndex;

    const row = document.createElement('div');
    row.className = `track-item-row ${isCurrent ? 'is-playing' : ''}`;
    row.dataset.id = track.id;

    row.innerHTML = `
      <div class="thumb-wrap">
        <img src="${track.imageUrl || 'icons/icon-48.png'}" alt="${track.name}">
      </div>
      <div class="title-col">
        <div class="track-name" title="${track.name}">${track.name}</div>
        <div class="artist-name" title="${track.artist}">${track.artist}</div>
      </div>
      <div class="side-meta">
        <span class="track-dur">${formatTime(track.duration)}</span>
        <button class="instant-play-btn" title="Jump to song">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 19 12 7 20 7 4"></polygon></svg>
        </button>
      </div>
    `;

    row.addEventListener('click', () => {
      sendPlayerAction('PLAY_TRACK', { track, queue: state.queue, index });
    });

    queueList.appendChild(row);
  });
}

// ─── Playback Execution ──────────────────────────────────────────────────────

function playSelectedTrack(track, queue = null, index = null) {
  sendPlayerAction('PLAY_TRACK', { track, queue, index }).then(() => {
    state.currentTrack = track;
    state.isPlaying = true;
    updatePlayerUI();
    setTimeout(refreshRecentlyPlayed, 400);
  });
}

// ─── Lyrics Loader ───────────────────────────────────────────────────────────

async function loadLyricsForCurrentTrack() {
  if (!state.currentTrack) return;
  loadedLyricsTrackId = state.currentTrack.id;
  fpLyricsContent.innerHTML = `<div class="lyrics-loading">Fetching lyrics...</div>`;

  const lyrics = await fetchLyrics(state.currentTrack.name, state.currentTrack.artist);
  if (lyrics) {
    fpLyricsContent.textContent = lyrics;
  } else {
    fpLyricsContent.innerHTML = `<div class="lyrics-loading">No lyrics available for this song.</div>`;
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

function setupEventListeners() {
  // Navigation Tabs
  tabBtnHome.addEventListener('click', () => switchTab('home'));
  tabBtnSearch.addEventListener('click', () => {
    switchTab('search');
    setTimeout(() => searchInput.focus(), 80);
    if (!searchInput.value.trim() && searchResultsList.children.length === 0) {
      executeSearch('Trending Hits');
    }
  });
  tabBtnQueue.addEventListener('click', () => switchTab('queue'));

  // Live Search with 300ms debounce
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    const val = e.target.value;
    btnClearSearch.classList.toggle('visible', !!val);
    searchDebounceTimer = setTimeout(() => executeSearch(val), 320);
  });

  // Search instantly on Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchDebounceTimer);
      executeSearch(searchInput.value);
    }
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    btnClearSearch.classList.remove('visible');
    executeSearch('');
    searchInput.focus();
  });

  // Quick Genre Chips
  genrePills.querySelectorAll('.pill-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      genrePills.querySelectorAll('.pill-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const q = chip.dataset.query;
      searchInput.value = q;
      btnClearSearch.classList.add('visible');
      executeSearch(q);
    });
  });

  // Clear Recently Played
  btnClearRecent.addEventListener('click', () => {
    chrome.storage.local.set({ recentlyPlayed: [] }, () => {
      state.recentlyPlayed = [];
      renderRecentlyPlayedList([]);
      showToast('Recently played cleared');
    });
  });

  // Clear Queue
  btnClearQueue.addEventListener('click', () => {
    const keepCurrent = state.currentTrack ? [state.currentTrack] : [];
    sendPlayerAction('SET_QUEUE', { queue: keepCurrent, currentIndex: 0 }).then(() => {
      state.queue = keepCurrent;
      state.currentIndex = 0;
      updateQueueUI();
      showToast('Queue cleared');
    });
  });

  // ─── Full Player Expand / Minimize ──────────────────────────────────────────
  btnOpenFullPlayer.addEventListener('click', (e) => {
    // Avoid expanding if like button clicked
    if (e.target.closest('#btn-like')) return;
    fullPlayerModal.classList.add('open');
  });

  btnCloseFullPlayer.addEventListener('click', () => {
    fullPlayerModal.classList.remove('open');
  });

  // Toggle Lyrics
  btnToggleLyrics.addEventListener('click', () => {
    showLyrics = !showLyrics;
    btnToggleLyrics.classList.toggle('active', showLyrics);

    if (showLyrics) {
      fpArtContainer.style.display = 'none';
      fpLyricsContainer.style.display = 'block';
      loadLyricsForCurrentTrack();
    } else {
      fpArtContainer.style.display = 'flex';
      fpLyricsContainer.style.display = 'none';
    }
  });

  // Play / Pause (both mini & full player)
  btnPlayPause.addEventListener('click', () => sendPlayerAction('TOGGLE_PLAY'));
  fpBtnPlayPause.addEventListener('click', () => sendPlayerAction('TOGGLE_PLAY'));

  // Next / Prev (both mini & full player)
  btnNext.addEventListener('click', () => sendPlayerAction('SKIP_NEXT'));
  fpBtnNext.addEventListener('click', () => sendPlayerAction('SKIP_NEXT'));
  btnPrev.addEventListener('click', () => sendPlayerAction('SKIP_PREV'));
  fpBtnPrev.addEventListener('click', () => sendPlayerAction('SKIP_PREV'));

  // Shuffle & Repeat
  const toggleShuffleAction = () => {
    sendPlayerAction('TOGGLE_SHUFFLE').then((res) => {
      state.isShuffle = res?.isShuffle ?? !state.isShuffle;
      btnShuffle.classList.toggle('active', state.isShuffle);
      fpBtnShuffle.classList.toggle('active', state.isShuffle);
    });
  };
  btnShuffle.addEventListener('click', toggleShuffleAction);
  fpBtnShuffle.addEventListener('click', toggleShuffleAction);

  const toggleRepeatAction = () => {
    sendPlayerAction('TOGGLE_REPEAT').then((res) => {
      state.isRepeat = res?.isRepeat ?? !state.isRepeat;
      btnRepeat.classList.toggle('active', state.isRepeat);
      fpBtnRepeat.classList.toggle('active', state.isRepeat);
    });
  };
  btnRepeat.addEventListener('click', toggleRepeatAction);
  fpBtnRepeat.addEventListener('click', toggleRepeatAction);

  // Seek bar scrub handling (for both progress bars)
  const attachScrub = (container) => {
    let isDragging = false;
    const seekEvent = (e) => {
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = ratio * (state.duration || state.currentTrack?.duration || 0);

      state.currentTime = targetTime;
      updateProgressUI(targetTime, state.duration);
      return targetTime;
    };

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      isSeeking = true;
      const target = seekEvent(e);
      sendPlayerAction('SEEK', { time: target });

      const onMouseMove = (moveEvt) => {
        if (!isDragging) return;
        seekEvent(moveEvt);
      };

      const onMouseUp = (upEvt) => {
        if (isDragging) {
          const finalTime = seekEvent(upEvt);
          sendPlayerAction('SEEK', { time: finalTime });
          isDragging = false;
          setTimeout(() => { isSeeking = false; }, 100);
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  };

  attachScrub(progressBarWrap);
  attachScrub(fpProgressWrap);

  // Volume bar handling (for both sliders)
  const attachVolume = (container) => {
    let isDragging = false;
    const volEvent = (e) => {
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      state.volume = ratio;
      if (ratio > 0) lastUnmutedVolume = ratio;
      updateVolumeUI(ratio);
      sendPlayerAction('SET_VOLUME', { volume: ratio });
    };

    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      volEvent(e);

      const onMouseMove = (moveEvt) => {
        if (!isDragging) return;
        volEvent(moveEvt);
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  };

  attachVolume(volSliderWrap);
  attachVolume(fpVolWrap);

  // Mute buttons
  const toggleMute = () => {
    if (state.volume > 0) {
      lastUnmutedVolume = state.volume;
      state.volume = 0;
    } else {
      state.volume = lastUnmutedVolume || 0.8;
    }
    updateVolumeUI(state.volume);
    sendPlayerAction('SET_VOLUME', { volume: state.volume });
  };
  btnMute.addEventListener('click', toggleMute);
  fpBtnMute.addEventListener('click', toggleMute);

  // Like track
  const toggleLike = () => {
    const track = state.currentTrack;
    if (!track) return;

    if (state.likedTrackIds.has(track.id)) {
      state.likedTrackIds.delete(track.id);
      btnLike.classList.remove('active');
      fpBtnLike.classList.remove('active');
      showToast('Removed from Liked Songs');
    } else {
      state.likedTrackIds.add(track.id);
      btnLike.classList.add('active');
      fpBtnLike.classList.add('active');
      showToast('Saved to Liked Songs');
    }
    saveLikedTracks();
  };
  btnLike.addEventListener('click', toggleLike);
  fpBtnLike.addEventListener('click', toggleLike);

  // Settings Modal
  btnSettingsOpen.addEventListener('click', () => {
    settingsModal.classList.add('open');
  });

  const closeModal = () => settingsModal.classList.remove('open');
  btnModalCancel.addEventListener('click', closeModal);
  btnModalClose.addEventListener('click', closeModal);

  btnModalSave.addEventListener('click', () => {
    const val = inputUserId.value.trim();
    chrome.storage.local.set({ userId: val }, () => {
      closeModal();
      showToast(val ? 'User ID synced!' : 'Settings saved');
      refreshRecentlyPlayed();
    });
  });

  // Keyboard Shortcuts inside popup (Space to play/pause, Arrows to seek, Esc to close modal/full player)
  window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      if (e.key === 'Escape') {
        document.activeElement.blur();
        closeModal();
      }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      sendPlayerAction('TOGGLE_PLAY');
    } else if (e.key === 'Escape') {
      if (fullPlayerModal.classList.contains('open')) {
        fullPlayerModal.classList.remove('open');
      } else {
        closeModal();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const newTime = Math.min((state.duration || 99999), state.currentTime + 5);
      state.currentTime = newTime;
      updateProgressUI(newTime, state.duration);
      sendPlayerAction('SEEK', { time: newTime });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const newTime = Math.max(0, state.currentTime - 5);
      state.currentTime = newTime;
      updateProgressUI(newTime, state.duration);
      sendPlayerAction('SEEK', { time: newTime });
    }
  });

  // Runtime Broadcast Messages from Audio Engine
  chrome.runtime.onMessage.addListener((message) => {
    const { type, payload } = message;

    if (type === 'TIME_UPDATE') {
      state.currentTime = payload.currentTime;
      if (payload.duration) state.duration = payload.duration;
      if (!isSeeking) {
        updateProgressUI(state.currentTime, state.duration);
      }
    } else if (type === 'PLAY_STATE_CHANGE') {
      state.isPlaying = payload.isPlaying;
      updatePlayerUI();
    } else if (type === 'TRACK_CHANGED') {
      state.currentTrack = payload.track;
      state.isPlaying = true;
      state.currentTime = 0;
      updatePlayerUI();
      refreshRecentlyPlayed();
    } else if (type === 'VOLUME_CHANGED') {
      state.volume = payload.volume;
      updateVolumeUI(state.volume);
    } else if (type === 'SHUFFLE_CHANGED') {
      state.isShuffle = payload.isShuffle;
      btnShuffle.classList.toggle('active', state.isShuffle);
      fpBtnShuffle.classList.toggle('active', state.isShuffle);
    } else if (type === 'REPEAT_CHANGED') {
      state.isRepeat = payload.isRepeat;
      btnRepeat.classList.toggle('active', state.isRepeat);
      fpBtnRepeat.classList.toggle('active', state.isRepeat);
    } else if (type === 'QUEUE_CHANGED') {
      state.queue = payload.queue;
      state.currentIndex = payload.currentIndex;
      updateQueueUI();
      queueBadgeCount.textContent = state.queue.length;
    }
  });
}

function switchTab(tab) {
  tabBtnHome.classList.toggle('active', tab === 'home');
  tabBtnSearch.classList.toggle('active', tab === 'search');
  tabBtnQueue.classList.toggle('active', tab === 'queue');

  viewHome.classList.toggle('active', tab === 'home');
  viewSearch.classList.toggle('active', tab === 'search');
  viewQueue.classList.toggle('active', tab === 'queue');

  if (tab === 'queue') {
    updateQueueUI();
  }
}

function loadLikedTracks() {
  chrome.storage.local.get(['likedSongs'], (data) => {
    if (Array.isArray(data.likedSongs)) {
      state.likedTrackIds = new Set(data.likedSongs);
    }
  });
}

function saveLikedTracks() {
  chrome.storage.local.set({ likedSongs: Array.from(state.likedTrackIds) });
}

function loadSettings() {
  chrome.storage.local.get(['userId'], (data) => {
    if (data.userId) {
      inputUserId.value = data.userId;
    }
  });
}

// Start
init();
