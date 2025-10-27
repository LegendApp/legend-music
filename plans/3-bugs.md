## Plan
Resolve the open bugs from `plans/bugs.md` by tightening metadata hydration, recursive scanning, drag-and-drop folder handling, playlist export semantics, and playlist row hit targets so the desktop UX matches expectations.

## Metadata For Dropped Files
- File drops handled in `src/components/Playlist.tsx:481` only build stub `LocalTrack` objects and immediately invoke `localAudioControls.queue.append`, so queue entries never receive ID3 data unless they also live under a scanned library path.
- The full metadata pipeline (`extractId3Metadata`, `AudioPlayer.getTrackInfo`) is private to `src/systems/LocalMusicState.ts:343-410` and only exercised during `scanDirectory`, leaving externally dropped tracks stuck with `"Unknown Artist"` plus `0:00` duration.
- Introduce a shared async helper (either exported from `LocalMusicState` or extracted to a new utility) that:
  - Reads ID3 tags and duration for arbitrary file paths using the existing logic.
  - Returns a `LocalTrack` ready for queue insertion, including thumbnail kick-off via `ensureLocalTrackThumbnail`.
  - Handles failures gracefully and keeps filename fallback behavior.
- Update `handleFileDrop` to await metadata hydration before queue insertion, and to update existing queue entries if hydration completes after the append (via `updateQueueEntry` in `src/components/LocalAudioPlayer.tsx:88-119`).
- Verify native drag payloads (`convertNativeTracksToLocal` in `src/components/Playlist.tsx:720`) still bypass the new work, since those already arrive with metadata.

## Library Subdirectory Scanning
- `scanDirectory` in `src/systems/LocalMusicState.ts:459-519` only iterates immediate children (`instanceof File`) and skips nested `Directory` entries entirely, which matches the report about subfolders being ignored.
- Extend scanning to traverse subdirectories:
  - Accept both files and directories from `Directory.list()`, recursing depth-first or breadth-first without exploding stack depth.
  - Preserve performance instrumentation (`perfLog`, `perfCount`) and avoid duplicate work when directories repeat.
  - Consider honoring hidden folders or symlink handling if Expo FS exposes them (verify via `Directory` APIs).
- Revisit `scanLocalMusic` progress accounting (`scanTotal` currently equals number of root paths) to ensure UI feedback stays meaningful once subdirectory work spans more time.
- Add regression coverage in `__tests__/` (e.g., `useLibraryTrackList`) by mocking nested directory structures.

## Folder Drops Should Add Library Paths
- The macOS bridge (`macos/LegendMusic-macOS/DragDrop/DragDropView.swift:82-166`) filters drops by extension using `allowedFileTypes`, so Finder folders (no extension) are rejected before they reach JS, matching the bug.
- Update the native view to detect directories (`url.hasDirectoryPath` / resource values) and pass them to JS separately from audio files. Extend the JS bridge type in `src/native-modules/DragDropView.tsx` to expose a `directories: string[]` payload.
- Update `handleDrop` in `src/components/Playlist.tsx:527-534` to:
  - Distinguish between audio files and directories.
  - For each new directory, normalize the path (`file://` vs absolute) and append it to `localMusicSettings$.libraryPaths` if not already present.
  - Kick off `scanLocalMusic()` so the newly added folder is indexed immediately.
- Provide inline feedback (reuse `showDropFeedback`) to confirm folders were added, and guard against dropping non-audio directories by filtering on the JS side if needed.

## Save Playlist Flow
- The queue save button (`src/components/PlaylistSelector.tsx:118-127`) still shows tooltip `"Save queue"` and triggers `handleSaveQueue`.
- `useQueueExporter` (`src/components/PlaylistSelector/hooks.ts:228-272`) invokes `saveFileDialog`, forcing an OS dialog even though the desired behavior is automatic caching.
- Adjust the exporter so it:
  - Always writes to `getCacheDirectory("playlists")`, generating a timestamped filename (and optionally de-duplicating if one already exists).
  - Refreshes the playlist list via `loadLocalPlaylists()` after writing.
  - Surfaces success/failure logs or toasts without requiring user interaction.
- Rename UI affordances from “Save queue” to “Save Playlist” (tooltip, accessibility label/logs) to match the new UX.

## Playlist Row Hit Target
- Reports indicate edge clicks on playlist rows do not trigger selection. Current layout wraps `TrackItem` inside `TrackDragSource` (`src/components/Playlist.tsx:649-666`), and `TrackItem` renders a `Button` (Pressable) with `useListItemStyles` classes (`src/components/TrackItem.tsx:48-87`).
- Investigate the composed hit area:
  - Inspect `TrackDragSource`’s native view (`macos/LegendMusic-macOS/DragDrop/TrackDraggableView.swift`) for intercepting mouse events or shrinking bounds.
  - Confirm `LegendList` item containers (`@legendapp/list`) aren’t adding padding/margins that leave inert gutters.
  - Validate the `Button` component (`src/components/Button.tsx`) isn’t applying size/padding overrides (e.g., `size-7 pb-1.5`) when used in row mode.
- Once the root cause is identified, adjust the layout (e.g., ensure the Pressable stretches `w-full`, tweak tailwind classes, or set `pointerEvents="none"` on wrappers) so the entire rendered row, including borders, responds to clicks.
- Add regression coverage either via unit tests on `TrackItem` click handling (simulated events) or manual QA notes describing verification steps.

## Steps
- [x] Shareable metadata loader for arbitrary file paths and hook it into file drops with queue updates.
- [x] Make local library scanning recursive and cover it with tests.
- [x] Allow folder drops to register new library paths and trigger re-scans.
- [ ] Convert queue saving into an automatic cache write and rename the control to “Save Playlist”.
- [ ] Fix playlist row hit targets so edge clicks trigger selection/playback.
