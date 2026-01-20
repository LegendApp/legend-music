## Plan
Add AI playlist metadata (prompt + 5-word summary), editing/regeneration controls, playlist extension actions, a queue
AI add dropdown, and richer queue track context menus.

## Research Notes
- `src/components/MediaLibrary/AiPlaylistDropdown.tsx` handles AI playlist prompts and creation flow.
- `src/components/MediaLibrary/TrackList.tsx` renders playlist headers and could host AI description + extension controls.
- `src/systems/LocalPlaylists.ts` and `src/systems/LocalMusicState.ts` define playlist persistence and metadata shape.
- `src/systems/ai/prompts.ts` + `src/systems/suggestions/ai/aiProvider.ts` build and execute AI prompts.
- `src/components/PlaybackControls.tsx` owns the main window controls next to search.
- `src/components/Playlist.tsx` + `src/utils/trackContextMenu.ts` render queue items and context menus.

## Steps
- [x] Add an AI prompt that returns a 5-word playlist description and store prompt/summary metadata with AI playlists.
- [x] Update AI playlist creation to generate and persist the 5-word summary and prompt alongside the playlist.
- [x] Show the AI summary in the playlist header with an edit button that opens the full prompt editor; saving regenerates.
- [x] Add two playlist footer actions: extend with the existing prompt and extend with a new prompt.
- [x] Add a sparkle button left of the main search that opens a prompt + count dropdown (10/20/30/40/50) to fill
      the queue with AI suggestions, and add an "a" hotkey to trigger it with button tooltips/menus showing hotkeys
      in parentheses (e.g., "Search music (j)").
- [ ] Add queue track context menu actions: "Add 5 more like this", "Add 10 more like this", divider, and
      "Remove from playlist", wired to AI extension and queue removal logic.

Validation: Create an AI playlist, confirm the 5-word header summary displays, edit the prompt to regenerate the
playlist, use both extend actions, generate queue tracks from the sparkle dropdown, and run the queue context menu
actions to extend/remove tracks.
