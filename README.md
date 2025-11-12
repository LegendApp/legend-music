# Legend Music

Legend Music is a macOS-first local music player built with React Native. It ingests folders of audio files, keeps the library in sync via native filesystem watchers, and exposes a multi-window experience with a Skia-driven visualizer, floating overlay, and pop-out settings surfaces. State is persisted with `@legendapp/state` + `expo-file-system`, so the queue, library, and preferences survive restarts.

https://github.com/user-attachments/assets/061cae41-c47a-4977-b095-27d007b9d0e9

## Highlights

- Local-first ingestion: parse ID3/JS media tags, cache artwork, and rescan when Finder changes trigger the native watcher.
- Multi-window UI: a composable main window plus dedicated Media Library, Settings, Visualizer, and Current Song overlay windows managed by `WindowManager`.
- Native audio engine: the `AudioPlayer` module wraps `AVPlayer`, MediaRemote commands, Now Playing metadata, and streams FFT data to the Skia visualizer.
- Drag-and-drop queue management with customizable playback/bottom-bar controls, tooltips, portals, and hotkeys.

## Tech Stack & Tooling

- **Runtime:** React Native 0.78, `react-native-macos`, `@legendapp/state` for local state, `@legendapp/list` for high performance lists.
- **Styling:** NativeWind + Tailwind tokens (`global.css`, `tailwind.config.js`), Fluent UI Vibrancy surfaces, shared primitives inside `src/legend-kit`.
- **Native bridges:** Objective-C++ modules in `macos/LegendMusic-macOS` (AudioPlayer, WindowManager, DragDropView, FileDialog, FileSystemWatcher, SFSymbol) consumed through `src/native-modules`.
- **Persistence:** JSON/msgpack stores under `~/Library/Caches/LegendMusic` driven by `createJSONManager`, plus `.m3u` queue exports for interoperability.
- **Build/Test:** Bun (`bun.lock`) for dependency + script management, Jest (`bun run test`), Biome (`bun run lint`), and Xcode builds through `scripts/build.ts`/`scripts/package-app.ts`.

## Prerequisites

- macOS 13+ with Xcode 15+ CLI tools (required for `react-native-macos`, `xcodebuild`).
- Node 18 or newer and [Bun](https://bun.sh/).
- Ruby + Bundler + CocoaPods (`gem install bundler cocoapods`). Run `bundle install` once, then `bundle exec pod install` in `macos/` (and `ios/` if you touch that target).
- Watchman (recommended for reliable Metro file watching): `brew install watchman`.

## Quick Start

1. Install dependencies and boostrap pods: `bun bootstrap`.
2. In Terminal A, start Metro with logging: `bun run start`.
3. In Terminal B, launch the macOS binary: `bun run mac`. The CLI wraps `react-native run-macos` and will open `LegendMusic.app`.
4. Open **Settings → Library** to add one or more folders.
5. Use the playlist + playback controls (drag files in, reorder, or double-click library items).
7. Toggle auxiliary windows with hotkeys (e.g., `V` for the visualizer, `L` for the media library) or via the menus. Preferences persist under `~/Library/Caches/LegendMusic`.

### Useful Scripts

| Command | Purpose |
| --- | --- |
| `bun run start` | Start Metro with client logging. |
| `bun run mac` | Launch the macOS target via `react-native run-macos`. |
| `bun run test` | Run Jest with the React Native preset (`__tests__/` or `*.test.ts(x)`). |
| `bun run lint` | Biome check + format (read-only). |
| `bun run lint:fix` | Apply Biome lint + format fixes across `src/`. |
| `bun run build` | Release build via `scripts/build.ts` (xcodebuild → `macos/build/Build/Products/Release/LegendMusic.app`). |
| `bun run package` | Code-sign, notarize, and zip the release build via `scripts/package-app.ts` (writes artifacts to `dist/`). |
| `bun run publish` | Convenience command that runs `build` followed by `package`. |

## Using the App

### Managing your library

- Library folders live in `settings$.library` (managed through **Settings → Library**). Paths are persisted via `localMusicSettings.json`.
- Adding or removing a folder triggers a rescan that parses tags with `id3js`/`jsmediatags`, caches thumbnails, and records playlists in `localMusicState`.
- The `FileSystemWatcher` native module watches every configured directory. When files change, `scanLocalMusic()` reruns automatically after a short debounce.
- If you need a manual reset, clear the cache directory at `~/Library/Caches/LegendMusic/data` and restart the app.

### Playback, queue, and drag-and-drop

- Playback runs through the `AudioPlayer` native module. It maintains Now Playing metadata, media key hooks, and emits FFT frames for the visualizer.
- The queue (`queue$.tracks`) is persisted via `PlaylistCache` both as JSON and as an `.m3u` so the session survives restarts and can be exported.
- Drag files or folders from Finder into the playlist region or onto the window chrome via `DragDropView`. Internal drag-and-drop uses `DraggableItem`/`DroppableZone` to reorder or send tracks to playlists.
- Customize the playback toolbar and the bottom bar shortcuts under **Settings → Customize UI**. Layouts are stored in `settings$.ui`.

### Windows & default hotkeys

| Window/Action | Default hotkey | Notes |
| --- | --- | --- |
| Toggle Media Library window | `L` | Opens `MediaLibraryWindow` with the tree + track list. |
| Toggle Visualizer | `V` | Shows `VisualizerWindow` (Skia preset picker + FFT). |
| Search current list | `J` | Focuses the omnibox/search input. |
| Play/Pause | Media key or `Space` | Media keys handled natively; space toggles when the playlist has no text focus. |
| Next/Previous | Media keys | Falls back to queue navigation controls. |
| Toggle Shuffle | `⌥ + S` | Uses `settings$.playback.shuffle`. |
| Cycle Repeat | `⌥ + R` | Cycles `off → track → queue`. |

Hotkeys are defined in `src/systems/hotkeys.ts` and persisted to `Cache/hotkeys.json`. You can customize the hotkeys in the settings or edit that file while the app is closed.

## Building & Packaging

### Release build (.app only)

1. Ensure pods are installed (`macos/`).
2. Run `bun run build`. The script drops into `macos/` and executes `xcodebuild -scheme LegendMusic-macOS -configuration Release`.
3. The resulting app lives at `macos/build/Build/Products/Release/LegendMusic.app`. You can copy it to `/Applications` for local testing.

## Testing & Quality

- `bun run test` runs Jest with the React Native preset (`jest.config.js`). Keep specs in `__tests__/` or next to the code using `*.test.ts(x)`.
- `bun run lint`/`bun run lint:fix` run Biome using the repo’s 4-space, double-quote, 120-character policy. Tailwind classNames should come from `global.css` tokens.
- UI logic should be covered with focused unit tests (mock native modules when bridges are unavailable). Run tests before raising a PR.

## Project Layout

| Path | Description |
| --- | --- |
| `src/` | TypeScript sources, bundled via Metro. Entry point is `src/App.tsx`. |
| `src/components/` | Shared UI (PlaybackArea, Playlist, Buttons, DnD, tooltips, TitleBar, etc.). |
| `src/systems/` | Domain state (library scanning, queue/cache, settings, hotkeys, playback interaction). |
| `src/overlay/` | Current song overlay windows, state, constants, animations. |
| `src/visualizer/` | Visualizer windows, presets, shaders, stored preferences. |
| `src/native-modules/` | JS faces for macOS native modules (`AudioPlayer`, `WindowManager`, `DragDropView`, `FileDialog`, `FileSystemWatcher`). |
| `src/windows/` | Window management helpers (`WindowProvider`, `WindowsNavigator`). |
| `legend-kit/` | Design system primitives shared across Legend apps. |
| `app/`, `app.json` | Expo routing metadata. |
| `macos/`, `ios/` | Native workspaces/projects (keep macOS-specific changes inside `macos/`). |
| `scripts/` | Bun-powered automation (build, package, CI helpers). |
| `patches/` | `patch-package` diffs applied after install—update when bumping dependencies. |
| `global.css`, `tailwind.config.js`, `nativewind-env.d.ts` | Tailwind tokens + NativeWind setup. |
| `assets/` | Static media (artwork, icons). |
| `__tests__/` | Jest specs for shared logic. |
| `plans/`, `claude-plans/`, `plan-queue.md` | Internal task tracking notes (update when following plan files). |

## Persistence & caches

- All observable stores (`localMusicSettings`, `LibraryCache`, `PlaylistCache`, `settings$, hotkeys$, visualizer preferences`) write to `~/Library/Caches/LegendMusic/data/*.json/lgm`.
- Queue exports and imports use M3U via `saveQueueToM3U`/`loadQueueFromM3U`. Clear `queue.m3u` if you need to reset the session.
- Album art is cached under `~/Library/Caches/LegendMusic/artwork/<hash>.<ext>` with versioning handled in `LocalMusicState`.
- Removing the cache directory is the fastest way to reset the app without touching Git.

## Troubleshooting

- **Metro won’t refresh:** stop `bun run start`, delete `node_modules/.cache`, and restart with `bun run start -- --reset-cache`.
- **Pods/cocoapods errors:** run `brew install cocoapods`, then `cd macos && bundle exec pod install`. Clean build directories if Xcode complains.
- **Library folders don’t scan:** ensure the app has Full Disk Access for the selected directories and that they’re not on a network share. Toggling the folder in Settings will re-register the watcher.
- **Hotkeys not firing:** ensure the Legend Music window is focused. Delete `~/Library/Caches/LegendMusic/data/hotkeys.json` to restore defaults.
- **Visualizer looks blank:** confirm playback is running and reopen the window. `AudioPlayer` only emits FFT data when tracks are actively decoding.
- **Codesign/notarization fails:** double-check the `.env` credentials, make sure you’re using a Developer ID certificate, and that Xcode is signed into the same Apple ID.

Legend Music is still evolving—refer to the `plans/` directory for active tasks, keep lint/tests green, and prefer Bun-powered scripts for everything from installs to releases.
