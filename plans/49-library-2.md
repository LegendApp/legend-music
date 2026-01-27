## Plan
Simplify the media library into a single Library entry and drive grouping/sorting from the active header, ensuring
outer groups follow the sort column and inner tracks follow default per-group ordering.

## Research Notes
- `src/components/MediaLibrary/Sidebar.tsx` defines the Library view list and handles selection changes.
- `src/components/MediaLibrary/TrackList.tsx` owns the sortable header state and table columns.
- `src/components/MediaLibrary/useLibraryTrackList.ts` builds grouped track data for artists/albums and applies sorting.
- `src/systems/LibraryState.ts` defines `LibraryView` and default UI state.
- Tests for grouping/sorting live in `src/components/MediaLibrary/__tests__/useLibraryTrackList.test.ts`.

## Steps
- [x] Update library navigation to expose a single Library item; align view state defaults and any view-selection logic.
- [x] Rework grouping logic so header sort drives grouping + outer sort (artist/album/title) with unknown artist/album
      forced to the end; keep date-added as flat list; implement inner sort defaults per grouping.
- [x] Adjust header/title display to reflect the active grouping state and ensure UI interactions still map to the
      updated view model.
- [x] Update and add tests for grouped ordering, unknown group placement, and flat list behavior when sorting by title
      or date-added.

## Validation
Manual validation: verify the sidebar shows a single Library entry, header sorting changes grouping and outer order,
artist groups sort inner tracks by album+track number, album groups sort by track number, title/date-added show a
flat list, and Unknown Artist/Album groups stay at the end. (Not run in this session.)
