## Plan
Build out Media Library playlist UX end-to-end:
- Drag songs onto playlists in the sidebar to add them.
- Track row context menus support “Add to Playlist…” (lists playlists).
- Playlist row context menus support rename/delete (+ import/export/reveal).
- Discover and include any `.m3u` files inside configured library folders (in addition to cache `data` playlists).
- Change search to filter the current view (not switch to a separate “search” view).

This work should preserve existing observable patterns (`libraryUI$`, `localMusicState$`), `.m3u` persistence, and queue integration.

## Current Files & Concepts (No Prior Context Required)
- Media library view: `src/components/MediaLibrary.tsx`
- Sidebar: `src/components/MediaLibrary/Sidebar.tsx`
- Track table: `src/components/MediaLibrary/TrackList.tsx`
- Track list builder/selection/queue actions: `src/components/MediaLibrary/useLibraryTrackList.ts`
- Playlist persistence and loading: `src/systems/LocalMusicState.ts`
  - `localMusicState$.playlists`
  - `loadLocalPlaylists()`, `createLocalPlaylist()`, `saveLocalPlaylistTracks()`
- UI state: `src/systems/LibraryState.ts`
  - `libraryUI$.selectedView`, `libraryUI$.selectedPlaylistId`, `libraryUI$.searchQuery`
- Internal (non-macOS) drag/drop: `src/components/dnd/*`
  - `MEDIA_LIBRARY_DRAG_ZONE_ID`, `LOCAL_PLAYLIST_DRAG_ZONE_ID`, `DragDropProvider`, `DraggableItem`, `DroppableZone`
- macOS native drag/drop: `src/native-modules/DragDropView.tsx`, `src/native-modules/TrackDragSource.tsx`
- macOS context menus: `src/native-modules/ContextMenu.ts` (`showContextMenu`)
- Toasts (currently no actions): `src/components/Toast.tsx` (`showToast`)

## Desired UX

### A) Search behavior change (important foundation)
- The sidebar search box (`libraryUI$.searchQuery`) filters the *current view’s* content.
- Search should NOT change `selectedView` to `"search"`; remove `"search"` from `LibraryView` if present.
- Filtering rules:
  - Songs view: filter song rows by title/artist/album.
  - Artists view: filter tracks by title/artist/album, then group with artist separators.
  - Albums view: filter tracks by title/artist/album, then group with album separators.
  - Playlist view: filter within the playlist (preserve playlist order), optionally disabling reorder/remove while search is non-empty (recommended for correctness unless you implement source-index mapping).
  - Starred view (if still placeholder): “Coming soon” and ignores search.

### B) Drag songs onto playlist rows (sidebar)
- Drag one or many songs from the track table onto a playlist row in the sidebar:
  - Default drop behavior: append to end.
  - Default insert policy: de-dupe by absolute `filePath` (recommended).
  - Provide a consistent user feedback message (toast) like “Added 12 tracks to Playlist Name”.
  - If dropping on the currently selected playlist, the table should update immediately.
- Visual affordance:
  - When a drag is hovering a playlist row, highlight the row.
  - Optional: show “+” overlay or subtle border.

Platform behavior:
- Non-macOS (internal DnD): `DroppableZone` accepts `DragData` from `MEDIA_LIBRARY_DRAG_ZONE_ID`.
- macOS: handle native track drags via `DragDropView` per playlist row (`onTrackDragEnter/onTrackDragLeave/onTrackDrop`).
  - Ensure the track drag payload includes `filePath` so the drop handler can persist paths.

### C) Track context menu “Add to Playlist…”
- On each track row:
  - Right-click context menu includes “Add to Playlist…”.
  - The per-row ellipsis menu includes “Add to Playlist…” too (optional but recommended for discoverability).
- “Add to Playlist…” behavior:
  - Lists all playlists (local + discovered library-folder playlists; see below).
  - Selecting a playlist adds the clicked track.
  - Selection semantics:
    - If multiple rows are selected and the clicked row is part of the selection: add all selected tracks.
    - Otherwise: add only the clicked track.
- Because the native menu module does not support nested submenus, implement as a two-stage menu:
  1) First menu: includes `Add to Playlist…`
  2) If selected: open a second menu at the same cursor point listing playlists (ids like `playlist:${id}`).

### D) Playlist row context menu (right click)
Local playlists (editable, stored in cache `data`):
- Rename (inline edit row; enter/blur to commit; esc cancels if feasible).
- Delete (confirm before deleting).
- Reveal in Finder (open containing folder / file).
- Export `.m3u` (see Export section).
- Duplicate to local playlist (useful when source is library-folder playlist).

Library-folder playlists (discovered from library paths, likely read-only by default):
- Reveal in Finder.
- Import/Duplicate to local playlist in cache `data`.
- Optionally Rename/Delete disabled (or require explicit confirmation and note it edits files in the user’s library folder).

### E) Playlist metadata & empty/missing handling
- Playlist view should show:
  - Track count, total duration (sum of known durations), and missing-track count.
  - A clear empty state (“Drop songs here or use Add to Playlist…”).
- Missing tracks:
  - Display them with `isMissing: true`.
  - Provide row actions: “Reveal missing path” (if possible) or “Remove from playlist”.

### F) Sorting options (no keyboard shortcuts)
In playlist view:
- Default sort is “Custom (playlist order)”.
- Add simple sorting options:
  - Title, Artist, Album (non-destructive view sort; does not rewrite `.m3u` unless user explicitly chooses “Apply sort to playlist”).
- If you implement non-destructive sorting, disable reorder operations while sorted (since reorder implies canonical order changes).

### G) Undo / safety for destructive actions
Implement a minimal action-capable toast:
- Extend `src/components/Toast.tsx` to support an optional action button:
  - `showToast(message, type, action?: { label: string; onPress: () => void })`
  - Make toast container `pointerEvents="auto"` and include a small `Button`.
- Use it for:
  - Add tracks to playlist (undo removes the added paths).
  - Remove tracks from playlist (undo re-inserts them).
  - Delete playlist (undo recreates file + restores prior content if available; or defer undo for delete if too complex).

## Data Model Changes

### 1) Remove “search” view
- Update `LibraryView` in `src/systems/LibraryState.ts` to remove `"search"`.
- Update any code paths that assume search is a view (track list builder tests included).

### 2) Track item provenance for playlist edits
In `src/components/MediaLibrary/useLibraryTrackList.ts`:
- When building playlist view rows, include:
  - `sourceTrack` (resolved `LibraryTrack` or missing placeholder)
  - `sourceIndex` = index into the underlying playlist’s `trackPaths`
- Use `sourceIndex` for:
  - Removal when filtered
  - Reorder operations (only when not filtered/sorted unless you implement robust mapping)

### 3) Playlists need a source type
Extend `LocalPlaylist` in `src/systems/LocalMusicState.ts` (or define a new union type) to track origin:
- `source: "cache" | "library-folder"`
- `isEditable: boolean` (or derive from `source`)
- `originRoot?: string` (which library root it came from)

Ensure the sidebar renders playlists grouped or labeled by source.

## Playlist Persistence & Discovery

### A) Cache `data` playlists (existing)
- Continue storing editable local playlists in `getCacheDirectory("data")`.
- Continue filtering out `queue.m3u`.

### B) Discover `.m3u` files in library folders (new)
- Library roots are stored in settings and used for scanning audio; use the same roots:
  - `librarySettings$.paths` in `src/systems/LocalMusicState.ts`
- Implement a discovery function:
  - `findM3UFilesInLibraryRoots(roots: string[]): Promise<string[]>`
  - Recursively walks each root (set a max depth and/or ignore huge directories to avoid UI hangs).
  - Include `.m3u` and `.m3u8` if desired; exclude `queue.m3u`.
- Parse discovered playlists into `LocalPlaylist` entries with `source: "library-folder"`.
- Merge with cache playlists into `localMusicState$.playlists`:
  - Stable ids should use absolute file path (consistent with existing playlist ids).
  - Sort by name within each group.
- Add an explicit “Reload playlists” code path after create/rename/delete/export.

## Playlist Mutations API (LocalMusicState)
Add helper functions in `src/systems/LocalMusicState.ts` (or a new `src/systems/LocalPlaylists.ts`):

1) Add tracks
- `addTracksToPlaylist(playlistId: string, trackPaths: string[], opts?: { dedupe?: boolean }): Promise<void>`
  - Resolve playlist by id.
  - Merge track paths (apply de-dupe by default).
  - Persist via `saveLocalPlaylistTracks`.
  - Show toast feedback.

2) Rename
- `renamePlaylist(playlistId: string, nextName: string): Promise<void>`
  - Only allow for editable playlists (default: `source === "cache"`).
  - Rename underlying file:
    - Handle filename collisions by suffixing ` (2)`, ` (3)`, etc.
  - Update `localMusicState$.playlists` entry id/filePath.
  - If `libraryUI$.selectedPlaylistId` matches old id, update it to new id.

3) Delete
- `deletePlaylist(playlistId: string): Promise<void>`
  - Only allow for editable playlists by default.
  - Delete underlying `.m3u` file.
  - Remove from `localMusicState$.playlists`.
  - If active selection, switch to Songs and clear `selectedPlaylistId`.

4) Export
- `exportPlaylistToFile(playlistId: string): Promise<string | null>`
  - Writes a `.m3u` file to a deterministic export location under cache `data` (e.g., `data/exports/<name>.m3u`).
  - Returns the exported path so the UI can “Reveal in Finder”.

5) Import/Duplicate
- `duplicatePlaylistToCache(playlistId: string, nextName?: string): Promise<void>`
  - Reads the source playlist file, writes a new cache `data` `.m3u` file, reloads playlists.

## UI Implementation Details

### 1) Sidebar drop targets + playlist context menus
File: `src/components/MediaLibrary/Sidebar.tsx`
- Each playlist row:
  - On non-macOS: wrap in `DroppableZone` with `allowDrop` accepting `media-library-tracks`.
  - On macOS: wrap in `DragDropView` to receive `onTrackDrop` events.
  - Use hover/active state to style the row during drag-over.
- Add `onRightClick` per playlist row:
  - Use `showContextMenu` with items based on playlist `source`.
  - Implement inline rename row state:
    - `editingPlaylistId`, `draftName`
    - On commit, call `renamePlaylist`.
  - Delete:
    - Confirm (use `Alert`) then call `deletePlaylist`.

### 2) Track table “Add to Playlist…” menu
Files: `src/components/MediaLibrary/TrackList.tsx`, `src/components/MediaLibrary/useLibraryTrackList.ts`
- Add a menu item:
  - `Add to Playlist…`
- Two-stage menu:
  - First stage selects the action.
  - Second stage lists playlists with ids like `playlist:${playlist.id}`.
- Determine which tracks to add:
  - If selection contains index: add selection.
  - Else add the clicked row only.
- Add a toast + undo:
  - Store which playlist and which paths were newly added so undo can remove them.

### 3) Track actions parity in playlist view
File: `src/components/MediaLibrary/TrackList.tsx`
- When `selectedView === "playlist"`:
  - Add row menu item “Remove from playlist” (and apply to selection).
  - Keep existing “Play Now / Play Next”.
  - For missing tracks, include “Remove from playlist” and disable “Play Now”.

### 4) Sorting controls + playlist header
Add a small header above the table in playlist view:
- Playlist title, metadata, and a sort dropdown.
- Sort dropdown can reuse `showContextMenu` (macOS) or a simple `Button` that toggles an inline list.

## Tests

### Unit tests (recommended)
- Playlist discovery:
  - Mock filesystem listing under library roots; ensure `.m3u` files are included and `queue.m3u` excluded.
- Playlist mutations:
  - `addTracksToPlaylist` de-dupe works; undo removes paths.
  - `renamePlaylist` updates ids and selection id.
  - `deletePlaylist` clears selection if active.
  - `exportPlaylistToFile` creates file and returns path.

### Existing tests to update
- `src/components/MediaLibrary/__tests__/useLibraryTrackList.test.ts`
  - Update for “search filters current view” behavior.
  - Add coverage for playlist-view filtering behavior (if implemented).

## Steps
- [x] Change search to filter current view; remove “search” view.
- [x] Add playlist discovery in library roots and merge into `localMusicState$.playlists`.
- [x] Add playlist mutation helpers: add, rename, delete, export, duplicate/import (+ collision handling).
- [x] Add action-capable toast and wire undo for add/remove (and optionally delete).
- [x] Implement sidebar drop-to-add (internal DnD + macOS native drop) with highlight.
- [x] Implement track “Add to Playlist…” (two-stage menu, selection-aware).
- [ ] Implement playlist row context menu rename/delete/reveal/export/import.
- [ ] Add playlist metadata header and sorting controls (disable reorder while filtered/sorted).
- [ ] Update/add tests and do a manual macOS UI pass.

Validation:
- Run `bun run test`.
- Manual: drag tracks onto playlist rows, add via menus, rename/delete with confirmation, verify persistence across restart, verify library-folder playlists appear, verify search filters within current view.
