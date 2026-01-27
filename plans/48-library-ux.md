## Plan
Refresh media library queue interactions for grouped Artist/Album views: restore headings, add group actions,
and refine click/queue behavior for tracks and sections.

## Research Notes
- `src/components/MediaLibrary/TrackList.tsx` renders the library track list and likely owns click/hover behavior.
- `src/components/MediaLibrary/useLibraryTrackList.ts` builds grouped track data for artists/albums and handles
  queue actions.
- `src/components/TrackItem.tsx` is used for per-track rows and is a good spot for a hover enqueue button.
- `src/utils/queueActions.ts` and `src/components/PlaylistSelector/hooks.ts` define queue action semantics.
- `src/utils/trackContextMenu.ts` already exposes enqueue/play-next actions and can inform UX parity.

## Steps
- [ ] Audit current artist/album grouping data and track click handling; define section metadata needed for
      header actions and "play from here" behavior.
- [ ] Restore artist/album headings in the library track list and render header actions (play all, enqueue all)
      with hover/focus affordances and tooltips.
- [ ] Add per-track hover "+" enqueue control; implement double-click to replace queue with section tracks
      (queued from the start of the section) while starting playback at the clicked track; keep single click
      as select-only and Shift+click as enqueue-only.
- [ ] Update any queue action helpers/tests as needed, and add/adjust UI tests for the new interactions.

## Validation
Manual validation: verify artist/album views show headings with play/queue actions, track hover "+" enqueues only
that track, double-click replaces queue with section tracks (queued from start) while starting playback at the
clicked track (single click only selects), and Shift+click queues without clearing. (Not run in this session.)
