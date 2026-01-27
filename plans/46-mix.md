## Plan
Add “Start Mix from Streaming” and “Start Mix from Library” actions to track context menus so a mix starts by
replacing the queue with the selected track, then appending up to 20 AI suggestions from the chosen source.

## Research Notes
- `src/utils/trackContextMenu.ts` builds shared track context menu items and handles selection fallbacks.
- Track right-click menus in `src/components/MediaLibrary/useLibraryTrackList.ts` and
  `src/components/MediaLibrary/DetailView.tsx` call `handleTrackContextMenuSelection`.
- Queue track context menu actions live in `src/components/Playlist.tsx` (and already call `fetchSuggestions`).
- `queueControls.replace` and `queueControls.append` in `src/components/AudioPlayer.tsx` handle queue resets
  and additions while managing playback state/history.
- `AiPromptSource` values (`"streaming"` vs `"local-library"`) live in `src/systems/ai/promptSource.ts`, and the AI
  provider uses them to include the local library CSV and restrict resolution.
- `fetchSuggestions` in `src/systems/suggestions/service.ts` supports `mode: "queue-extension"` with
  `source: "manual"` to bypass auto-extend settings.

## Steps
- [x] Add track context menu items for “Start Mix from Streaming” and “Start Mix from Library”, and wire their
      selection IDs to a mix-start handler.
- [x] Implement a mix-start helper: `queueControls.replace([track])`, then call `fetchSuggestions` with
      `mode: "queue-extension"`, `source: "manual"`, `count: 20`, and the chosen `promptSource`; append results and
      show error toasts on failure.
- [x] Ensure all track context menu entry points (library list, detail view, queue track menu) route the new IDs
      to the mix-start handler and keep menu ordering/separators consistent.
- [ ] Update/extend tests if any menu-selection or suggestion-action coverage exists; otherwise note manual
      validation only.

## Validation
Right-clicking a track in the library list, detail view, or queue shows the new actions. Selecting either action
clears the queue to the chosen track, starts playback, and appends up to 20 suggested tracks. If suggestion
fetching fails, an error toast appears; fewer than 20 additions still succeed.
