## Plan
Reduce maintenance drag by consolidating duplicated queue/selection logic, excising unused UI primitives, and decomposing oversized playlist and media-library surfaces into smaller, testable modules.

## Duplicate Logic Cleanup
- Merge the duplicated playlist queue resolution branches in `src/components/PlaylistSelector.tsx:108` and `src/components/PlaylistSelector.tsx:185` into a shared helper that maps playlist IDs to resolved tracks and handles missing files uniformly.
- Replace the bespoke selection + drag handling in `src/components/MediaLibrary.tsx:409`-`src/components/MediaLibrary.tsx:555` with the existing `usePlaylistSelection` hook so playlist and library share identical multi-select behavior.
- Extract the repeated library-item-to-track filtering from `src/components/PlaylistSelector.tsx:160` and `src/components/MediaLibrary.tsx:123` into a shared utility to keep queue actions and context menus consistent.
- Centralize the "shift to play-next" action detection used across `MediaLibrary`, `PlaylistSelector`, and `JumpSearchMenuDropdown` into a single helper to avoid drift.

## Remove Dead/Unused Code
- Delete `src/components/WithCheck.tsx:7`, which is superseded by `WithCheckbox` and has no references.
- Drop unused input wrappers `src/components/StyledInput.tsx:8` and `src/components/TextInput.tsx:9`; nothing imports them after the TextInputSearch migration.
- Remove the orphaned `src/components/VideoPlayer.tsx:6` webview wrapper.
- Prune unused shadows (`ShadowGlass`, `ShadowSubtle`) from `src/utils/styles.ts:3` and stop importing `ShadowDropdown` in `DraggableItem` unless it is actually applied.

## Complexity Reduction
- Split `src/components/MediaLibrary.tsx:1` into smaller modules (search input, tree panel, track list, drag bridge) and move memo-heavy logic into hooks to improve readability and test coverage.
- Factor `src/components/PlaylistSelector.tsx:1` into focused hooks/components for playlist resolution, queue export, and library toggling so the main selector renders stay concise.
- Break the keyboard + search orchestration in `src/components/JumpSearchMenuDropdown.tsx:1` into reusable hooks (search aggregation, keyboard focus management) to cut down the 300+ line component.

## Tests & Verification
- Extend unit coverage around the new queue helper to confirm dedupe, order, and missing-track handling.
- Add selection-behavior tests covering multi-select, shift selection, and drag hand-off once `usePlaylistSelection` powers both playlist and library views.
- Smoke test playlist/library flows on macOS to ensure drag, context menus, and search still function after refactors.

## Steps
- [x] Extract shared queue + library track utilities and wire them into `PlaylistSelector` and `MediaLibrary`.
- [x] Replace custom media-library selection with the common hook and centralize shift-action helpers.
- [x] Remove unused components (`WithCheck`, `StyledInput`, `TextInput`, `VideoPlayer`) and trim dead styles.
- [x] Decompose `MediaLibrary`, `PlaylistSelector`, and `JumpSearchMenuDropdown` into smaller units with targeted tests.
