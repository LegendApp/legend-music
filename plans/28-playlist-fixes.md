## Plan
Tighten up playlist saving (name prompt + toast), ensure playlist track IDs stay unique even with duplicates, and expose key actions in the macOS menu bar.

## Current Files & Concepts (No Prior Context Required)
- Save playlist UI and control wiring: `src/components/PlaybackControls.tsx`, `src/components/PlaylistSelector/hooks.ts` (`useQueueExporter`)
- Dropdown primitives (anchor, content, focus management): `src/components/DropdownMenu.tsx`
- Toast feedback: `src/components/Toast.tsx`
- Playlist persistence helpers: `src/systems/LocalMusicState.ts` (`createLocalPlaylist`, `saveLocalPlaylistTracks`)
- Track resolution (playlist -> queue tracks): `src/utils/trackResolution.ts`
- M3U parsing/writing and queue persistence: `src/utils/m3u.ts`, `src/utils/m3uManager.ts`
- macOS menu plumbing: `src/systems/MenuManager.ts`, `src/native-modules/NativeMenuManager.ts`, `macos/LegendMusic-macOS/AppDelegate.mm`, `macos/LegendMusic-macOS/Base.lproj/Main.storyboard`

## Desired UX
- Clicking "Save playlist" opens a dropdown that contains a text input for the playlist name plus a "Save" button.
- If the entered playlist name already exists, prompt to confirm overwrite before saving.
- Otherwise, saving creates a new playlist using the entered name (and auto-resolves file-name collisions similarly to other local playlists).
- After saving, show a toast confirming `"<playlist name> was saved"`.
- Playlist items can contain the same track multiple times without React key collisions or state glitches (IDs become unique by suffixing `-2`, `-3`, … when needed).
- macOS menu bar includes:
  - `View` menu: `Media Library`, `Visualizer`
  - `File` menu: `Save Playlist`

## Steps
- [x] Add a Save Playlist dropdown UI (input + Save button) anchored to the existing save control, including Enter-to-save and Escape-to-close behavior.
- [ ] Refactor `useQueueExporter` to accept an explicit playlist name, confirm overwrite on conflicts, save via `createLocalPlaylist`/`saveLocalPlaylistTracks`, and show a success toast after `loadLocalPlaylists()`.
- [ ] Make playlist/queue track IDs unique when duplicates exist (preserve `filePath`, but generate stable unique `id` values by suffixing).
- [ ] Add `File > Save Playlist`, `View > Media Library`, and `View > Visualizer` menu items in `Main.storyboard`, wire them in `AppDelegate.mm`, and handle command IDs in `src/systems/MenuManager.ts` (including enabled/checked state where applicable).

## Validation
- Manual: Save Playlist opens a naming dropdown; Save persists a new playlist and shows a toast with the chosen name; saving an existing name produces a unique name rather than overwriting unexpectedly.
- Manual: Playlists containing duplicate tracks render and behave correctly (no key warnings, selection/queue operations work).
- Manual (macOS): Menu items trigger the same actions as the UI buttons; View menu items reflect open/closed state; Save Playlist is disabled when the queue is empty.
