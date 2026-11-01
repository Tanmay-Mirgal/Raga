# Raga mobile: feature checklist

Legend: ✅ built in this change · 🟡 partly there · ⬜ not built (reason given)

"Built" means the code is written and type-checks, the JS bundle compiles, and the data / offline logic was
run against the live APIs. **Playback, the notification and lock-screen controls need a native rebuild and
have not been run on a phone yet** (see "Rebuild" below).

## Reliability (the API that kept going down)
- ✅ Several API hosts with automatic failover; a failing host is skipped for 60 s
- ✅ Timeouts, one quick retry, fail-fast when offline (no 8 s hangs)
- ✅ Every response cached (memory + disk). If the API is down you get the last good copy instead of an error
- ✅ Duplicate simultaneous requests merged
- ✅ If the JioSaavn wrapper is completely down, song search falls back to **Audius** (free, official public API, full-length streams)
- ✅ Broken upstream artist pages are rebuilt from search instead of showing an error
- ✅ HTML-escaped titles fixed (`&quot;` etc.)

## Playback and notification
- ✅ Keeps playing in the background and with the screen off
- ✅ Spotify-style media notification: artwork, title, artist, previous / play-pause / next, seek bar
- ✅ Lock-screen, Bluetooth, car and headset button controls
- ✅ Next song is chosen natively, so the queue keeps advancing even when the app is in the background
- ✅ Keeps playing after you swipe the app away (stops when you dismiss the notification)
- ✅ Pauses for calls and ducks for other apps' notifications
- ✅ Shuffle (shuffled queue, can be toggled while playing) and repeat off / all / one
- ✅ Previous restarts the song after 3 s, like Spotify
- ✅ Draggable seek bar with buffered indicator
- ✅ Playback speed 0.5x to 2x
- ✅ Sleep timer: 5 to 60 min or end of track
- ✅ Resumes your last queue and position when you reopen the app
- ✅ Streaming quality: Auto (320k on Wi-Fi, 160k on mobile data) / 96k / 160k / 320k
- ✅ Buffering indicator on the play button
- ⬜ Crossfade / gapless: not supported by react-native-track-player
- ⬜ Equalizer, volume normalisation: need a custom native module
- ⬜ Spotify Connect / Chromecast, car mode, Canvas videos, podcasts and audiobooks

## Queue and discovery
- ✅ Queue screen: tap to jump, reorder, remove
- ✅ Play next, Add to queue (song menu)
- ✅ Song radio and endless Autoplay of similar songs when the queue ends
- ✅ Synced lyrics (cached, so viewed lyrics work offline)
- ✅ Home: Recently played, Trending, New releases, Popular albums, Top artists, Featured playlists, mood shelves, AI Smart Mix
- ✅ Search: songs, albums, artists, playlists; searches your saved songs when offline
- ✅ Album page, Artist page (popular, albums, singles, fans also like, bio), Playlist page; Play, Shuffle, Download-all buttons
- ✅ Go to album / Go to artist from the song menu and the player
- 🟡 "Made for you" mixes: Smart Mix exists; daily mixes, Release Radar, Discover Weekly are not built
- ⬜ Charts, genre hub pages, voice search

## Library and offline (your main requirement)
- ✅ Download any song, album or playlist (Normal 160k or High 320k)
- ✅ **Every song you play is saved automatically**, so it replays without internet (oldest removed first once past your size limit: 250 MB to 2 GB)
- ✅ Next song in the queue is pre-saved too
- ✅ Offline mode switch, "You're offline" banner, offline-only queues
- ✅ Home, search and lyrics keep working from cache with no internet
- ✅ Likes work offline and sync to your account when you are back online
- ✅ Recently played list (stored on the device)
- ✅ Artwork is saved with the song, so covers show offline
- ✅ Wi-Fi-only downloads by default (switch in Settings)
- ✅ Settings: quality, autoplay, offline mode, auto-save, storage usage, clear auto-saved songs / downloads / browsing cache
- ✅ Liked Songs and playlists (existing, server-synced)
- ⬜ Saving albums and following artists: needs new tables and routes on the server
- ⬜ Playlist drag-to-reorder, custom playlist covers, collaborative playlists
- ⬜ Friend activity, Jam sessions, Wrapped

## Data source note
The JioSaavn wrapper (`saavn.sumit.co`) is an **unofficial** community project, and the songs it serves are
not licensed for third-party apps. It is fine for personal use, but it can disappear at any time and it is not
something to ship on the Play Store. Audius is a legitimate free source but only has independent artists, not
mainstream Bollywood. There is no free, legal API with the full Bollywood catalogue.

To avoid depending on one public instance, deploy your own copy of
[jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) and put it first:

```
EXPO_PUBLIC_SAAVN_API_HOSTS=https://your-instance.vercel.app
```

(comma-separated; add it to `.env` and to the `env` blocks in `eas.json`). Your own hosts are tried first, then `saavn.sumit.co`.

## Rebuild (required: native modules and config changed)
Added: `react-native-track-player`, `@react-native-async-storage/async-storage`, `expo-network`. Removed: `expo-av`.
Changed: `app.json` (Android notification permission, iOS background audio) and the app entry (`index.js`).

1. This machine's Android NDK `27.1.12297006` is corrupt (`source.properties` missing), which fails every Android build. Delete
   `%LOCALAPPDATA%\Android\Sdk\ndk\27.1.12297006` and let Gradle re-download it (or reinstall it in Android Studio's SDK Manager).
2. The existing `android/` folder is a stale prebuild from the old "Riffy" name. Regenerate it:
   ```
   npx expo prebuild --clean
   npx expo run:android
   ```
3. Expo Go cannot be used any more (native player module); use the dev build.
4. On Android 13+ the app asks for notification permission the first time you play a song. Allow it to see the media notification.
