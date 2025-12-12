## Plan
Upgrade the media library UI to a two-pane, local-first experience: a left sidebar with Library + Playlists sections, and a right track table. The implementation should preserve existing LegendApp observable patterns, drag-and-drop behavior, and playback queue integration, while laying groundwork for future multi-source plugins (Apple Music/Spotify).

## UI Layout
- Keep the current resizable split from `src/components/MediaLibrary.tsx` (`PanelGroup`/`Panel`/`ResizeHandle`), with the sidebar on the left and the track table on the right.
- Sidebar structure:
    - Top: global search box, bound to `libraryUI$.searchQuery`.
    - Section: **Library** with four static items:
        - Songs
        - Artists
        - Albums
        - Starred (placeholder; disabled for now)
    - Section: **Playlists**
        - Header row with label and a right-aligned `+` icon button to add a playlist.
        - Below: list of local playlists from `localMusicState$.playlists`.
    - Bottom (future): a “Sources” area with checkboxes to filter sources. For now, render a placeholder with a single checked “Local Music” item.
- Right pane:
    - Always a table view (for Songs, Artists, Albums, Playlists, Search), with columns:
        - Number
        - Title
        - Artist
        - Album
        - Duration
    - Add a fixed header row above the scrollable list to label columns.

## State & Data Model
- `library$` remains the unified local track source, derived from `localMusicState$.tracks`.
- Update `src/systems/LibraryState.ts` UI state to match the new sidebar:
    - Replace `selectedCollection`/`selectedItem` with:
        - `selectedView: "songs" | "artists" | "albums" | "starred" | "playlist" | "search"`
        - `selectedPlaylistId: string | null`
        - `searchQuery: string` (keep existing)
    - Provide small helper setters in this file (or in a new UI helper module) for selecting views and playlists.
    - Since `libraryUI$` is only consumed by MediaLibrary components, reshaping it should be safe.

## Sidebar Implementation
- Replace `src/components/MediaLibrary/LibraryTree.tsx` with a new sidebar component (e.g., `src/components/MediaLibrary/Sidebar.tsx`) or refactor the existing file to:
    - Render the search box at the top (move `src/components/MediaLibrary/SearchBar.tsx` inside the sidebar panel).
    - Render the **Library** section using `Button` rows and `useListItemStyles` for consistent selection styling.
        - Selecting Songs sets `libraryUI$.selectedView="songs"` and clears `selectedPlaylistId`.
        - Selecting Artists sets `selectedView="artists"`.
        - Selecting Albums sets `selectedView="albums"`.
        - Starred renders disabled (no click handler, or `enabled:false` if using a menu).
    - Render the **Playlists** section:
        - Source playlist metadata from `localMusicState$.playlists` (not `library$.playlists`, which is currently unused).
        - Selecting a playlist sets `selectedView="playlist"` and `selectedPlaylistId` to the playlist id.
        - `+` button behavior:
            - Insert a temporary playlist row into state (id like `pl-temp-${Date.now()}`) with empty `trackPaths` and `trackCount=0`.
            - Select it immediately and render an inline `TextInput` for naming.
            - Autofocus the input and select-all text.
            - On submit/blur:
                - If name is empty, discard the temporary playlist.
                - Else persist a new `.m3u` file and reload playlists.

## Playlist Persistence (Local)
- `.m3u` playlists should live in `getCacheDirectory("data")`.
- Update existing playlist loading:
    - Change `loadLocalPlaylists` in `src/systems/LocalMusicState.ts` to read `.m3u` files from `getCacheDirectory("data")` instead of `"playlists"`.
    - Filter out `queue.m3u` and any non-playlist `.m3u` files.
- Add minimal persistence helpers in `src/systems/LocalMusicState.ts` (or a new `src/systems/LocalPlaylists.ts`):
    - `createLocalPlaylist(name: string): Promise<LocalPlaylist>`
        - Write an empty `.m3u` (with `#EXTM3U` header) to the data directory.
        - Return the playlist object and update `localMusicState$.playlists`.
    - `saveLocalPlaylistTracks(playlist: LocalPlaylist, trackPaths: string[]): Promise<void>`
        - Use `writeM3U` from `src/utils/m3u.ts` to persist absolute file paths.
        - Update `trackPaths` and `trackCount` in memory.
    - Leave rename/delete as follow-up tasks.

## Reusable Table Primitive
- Create a small reusable table layout primitive under `src/components/` (e.g., `src/components/Table.tsx` plus companion subcomponents in the same file or siblings).
    - Keep it layout/styling only (no data ownership, sorting, or virtualization) so it works with `LegendList` and other lists.
    - API sketch:
        - `Table` wrapper provides background/border and optional header container.
        - `TableHeader` renders a single row of `TableCell` labels.
        - `TableRow` renders a horizontal flex row with hover/selected/active styles and mouse handlers (`onClick`, `onDoubleClick`, `onRightClick`).
        - `TableCell` supports `flex`, `minWidth`, `align="left|right|center"`, and truncation.
    - Default row + header styles should reuse tones from `useListItemStyles` and follow existing Tailwind conventions (no `StyleSheet`).
    - Ensure header/rows align by sharing the same column spec.
    - Column spec needed for MediaLibrary (exposed as a prop so other tables can reuse):
        - Number: fixed small width (~32–40px), right-aligned tabular nums.
        - Title: flex=3, truncated.
        - Artist: flex=2, truncated.
        - Album: flex=2, truncated.
        - Duration: fixed width (~64px), right-aligned tabular nums.
        - Optional trailing actions cell (fixed ~28px) for per-row menus without affecting the core 5-column header.
- Use this primitive for MediaLibrary first, then keep it generic for future tables (queue, multi-source results).

## Track Table & Views
- Replace `src/components/MediaLibrary/TrackList.tsx` with a table-based list built on the reusable Table primitives:
    - Use `Table` + `TableHeader` for the fixed column header row.
    - Keep `LegendList` for virtualization; render each track as a `TableRow` composed of `TableCell`s.
    - Do not modify shared `src/components/TrackItem.tsx` (used by Playlist). Any MediaLibrary-specific row wrapper should just compose the table primitives.
    - Row behavior:
        - Left-click uses existing selection logic via `usePlaylistSelection`.
        - Double-click enqueues the clicked track to the playback queue:
            - Use the existing pattern in `useLibraryTrackList.ts` (`localAudioControls.queue.append`), keeping modifier support if already present.
        - Per-row dropdown menu:
            - Add a right-side icon button that calls `showContextMenu` with items:
                - Play Now (`id: "play-now"`)
                - Play Next (`id: "play-next"`)
                - Star (`id: "star"`, `enabled:false`)
            - Map selections to:
                - Play Now → `localAudioControls.queue.insertNext(track, { playImmediately: true })`
                - Play Next → `localAudioControls.queue.insertNext(track)`
        - Keep right-click context menu if desired; it can share the same handler as the dropdown button.

### View-specific track building
- Refactor `src/components/MediaLibrary/useLibraryTrackList.ts`:
    - Replace reliance on `selectedItem` with `libraryUI$.selectedView` + `selectedPlaylistId`.
    - Search mode:
        - If `searchQuery.trim()` is non-empty, set/derive `selectedView="search"`.
        - Use all tracks as the source and filter by title/artist/album.
        - No grouping/separators.
    - Songs view:
        - Show all tracks from `library$.tracks` in current natural order.
    - Artists view (Option A grouping):
        - Sort a copy of tracks by normalized artist key then title (tracks are already artist/title sorted from scan, but do not depend on that).
        - Insert separator rows when the artist changes.
    - Albums view (Option A grouping):
        - Sort by album name (fallback “Unknown Album”), then title.
        - Insert separator rows when the album changes.
    - Playlist view:
        - Find the selected `LocalPlaylist` by id from `localMusicState$.playlists`.
        - Resolve ordered tracks via `resolvePlaylistTracks` in `src/utils/trackResolution.ts`.
        - Preserve `.m3u` order and mark missing tracks with `isMissing:true`.
    - Starred view:
        - Return an empty list and show a “Coming soon” placeholder in the UI.
- Adjust `LegendList` config:
    - Remove `getFixedItemSize()` in MediaLibrary to allow variable-height separator rows.
    - Keep a sensible `estimatedItemSize` (32–40px).

## Playlist Editing in Track Table
- Enable editing only when `selectedView="playlist"`:
    - Drag-and-drop reorder:
        - Add a new DnD type and zone id in `src/components/dnd/dragTypes.ts`:
            - `LocalPlaylistDragData { type:"local-playlist-track"; playlistId:string; trackPath:string; sourceIndex:number }`
            - `LOCAL_PLAYLIST_DRAG_ZONE_ID="local-playlist-tracks"`
            - Extend `DragData` union with this type.
        - Mirror `src/components/Playlist.tsx` patterns:
            - Wrap each playlist row in `DraggableItem` (non-macos) / `TrackDragSource` (macos).
            - Add `DroppableZone`s between rows (and at end).
            - `allowDrop` accepts:
                - Reorder drags from the same playlist/zone.
                - Optionally `media-library-tracks` to insert new tracks into the playlist.
            - `onDrop`:
                - If reorder: compute bounded target index, reorder `trackPaths`, then call `saveLocalPlaylistTracks`.
                - If inserting: splice in dropped track paths at target and persist.
            - Call `syncSelectionAfterReorder` from `usePlaylistSelection` to keep selection stable.
    - Remove tracks:
        - Wire delete/backspace via `usePlaylistSelection` `onDeleteSelection`.
        - Remove selected indices from `trackPaths` and persist.

## MediaLibraryView Wiring
- In `src/components/MediaLibrary.tsx`:
    - Remove `LibraryCollectionTabs` and any use of `selectedCollection`.
    - Sidebar panel renders the new Sidebar component.
    - Track panel renders the updated TrackList/table.
    - Keep or update the hint footer to match new actions (or remove if inaccurate).

## Tests
- Update `src/components/MediaLibrary/__tests__/useLibraryTrackList.test.ts`:
    - Replace `selectedItem` tests with `selectedView` tests:
        - Songs returns all tracks.
        - Artists/Albums insert separators and group correctly.
        - Search filters globally and ignores view.
        - Playlist preserves playlist order and flags missing tracks.
        - Numeric duration formatting still works.
- Add focused tests for playlist persistence helpers (mocking `expo-file-system/next` `File`/`Directory`) if helpers are added.

## Steps
- [x] Add new sidebar UI and `libraryUI$` selection model; remove top tabs.
- [x] Build reusable Table primitives under `src/components/`.
- [x] Refactor MediaLibrary track list into a 5-column table with per-row menu and enqueue on double click.
- [x] Implement Artists/Albums grouping with separators and make search switch to global results.
- [x] Integrate local playlists into the sidebar; implement inline create + focus naming flow.
- [x] Implement playlist track resolution, drag-and-drop reorder, remove, and persist `.m3u` in cache `data`.
- [x] Update tests and do a manual macOS UI pass.

Validation: Run `bun run test src/components/MediaLibrary/__tests__/useLibraryTrackList.test.tsx` and manually verify sidebar selection, search results, playlist create/reorder/save, and queue actions in-app.
