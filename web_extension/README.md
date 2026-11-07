# Raga - Background Music Player Browser Extension

A high-performance Chrome/Edge browser extension (Manifest V3) for streaming Indian & global music in the background with a clean, modern Sass-powered dark glassmorphism UI.

---

## 🌟 Key Features

1. **Continuous Background Playback (MV3 Offscreen Engine)**:
   - Music continues streaming seamlessly even when the extension popup is closed or when switching browser tabs.
   - Powered by Chrome Manifest V3 `AUDIO_PLAYBACK` Offscreen Document API and HTMLAudioElement.
   - Hardware Media Keys & OS Media Session integration (Play/Pause/Next/Prev from keyboard or lock screen).

2. **Recently Played Songs Carousel**:
   - Prominently showcases your recently played songs right on the main screen.
   - Shows live animated audio visualizer badges on the currently playing track.
   - 1-click instant playback with deduplication and local persistence (`chrome.storage.local`).
   - Optional sync with the Raga backend (`raga-music-player-node.onrender.com`).

3. **Simple, Clean & Modern Sass UI**:
   - Styled using modular Sass (`src/scss/`) compiled to high-speed CSS.
   - Glassmorphic dark theme inspired by Spotify & Raga Mobile.
   - Dynamic ambient glow behind the player based on the current track artwork.
   - Interactive smooth seek progress bar with millisecond accuracy.
   - Draggable volume control with instant mute/unmute toggle.
   - Quick genre pills (Trending, Bollywood, Punjabi, Arijit, Lo-Fi, Global).

4. **Global Keyboard Shortcuts**:
   - `Alt + Shift + P`: Play / Pause toggle
   - `Alt + Shift + N`: Next track
   - `Alt + Shift + B`: Previous track

5. **Search & Queue System**:
   - Instant debounced search querying millions of songs, artists, and albums.
   - Smart fallback mirrors (`saavn.sumit.co`, `saavn.dev`).
   - Upcoming queue view with reordering, clear queue, and auto-recommendation on queue completion.

---

## 🚀 How to Install & Load in Chrome / Edge / Brave

1. Open your Chromium-based browser (Chrome, Edge, Brave, Opera).
2. Go to `chrome://extensions/` (or `edge://extensions/`).
3. Turn ON **Developer mode** (toggle switch in the top-right corner).
4. Click the **Load unpacked** button.
5. Select the `web_extension` folder located at:
   ```text
   D:\Raga\web_extension
   ```
6. Click the puzzle icon 🧩 in Chrome's toolbar and pin **Raga**.
7. Click the **Raga** icon to open the player, search for your favorite tracks or click any trending hit, and enjoy uninterrupted background streaming!

---

## 🛠️ Sass Stylesheet Development

The extension includes both compiled `popup.css` (ready-to-run out-of-the-box) and full modular Sass source code in `src/scss/`.

To recompile or watch Sass styles during development:
```bash
cd D:\Raga\web_extension
npm install
npm run build:css   # One-time build
npm run watch:css   # Live file watcher
```

### Sass Architecture
- `src/scss/_variables.scss`: Color tokens, glow radii, typography, transitions.
- `src/scss/_mixins.scss`: Glassmorphism effects, custom scrollbars, text truncation.
- `src/scss/_recent.scss`: Recently played horizontal carousel, cards, and animated waves.
- `src/scss/_search.scss`: Search bar, filter pills, and track rows.
- `src/scss/_player.scss`: Bottom player, progress bar, controls, and volume slider.
- `src/scss/popup.scss`: Master entry stylesheet.

