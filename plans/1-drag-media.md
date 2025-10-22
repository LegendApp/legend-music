## Plan
Allow users to drag one or more tracks from the media library into the active playlist while preserving track order, giving visual feedback, and persisting the updated playlist state.

## Drag Architecture
- Audit existing drag-and-drop primitives (`DragDropContext`, `DraggableItem`, `DroppableZone`) to confirm they support cross-list dragging with metadata payloads.
- Define the drag payload shape for media tracks (track id, playlist source metadata) and ensure it propagates through the drag context.
- Evaluate whether we need hover throttling or auto-scroll support when dragging near playlist edges.

## Media Library Integration
- Attach draggable handles to media library track rows, wiring them to emit the new track payload when the drag starts.
- Guard against dragging disabled or loading tracks by disabling the drag affordance in those states.
- Surface a keyboard modifier or alternate gesture for adding tracks without removing them from their original collection.

## Playlist Drop Handling
- Convert the main playlist area into a droppable zone that accepts track payloads and computes the target insert index based on cursor position.
- When tracks are dropped, call the playlist mutation API to append or insert while maintaining the original order of the dragged selection.
- Prevent duplicate entries by checking existing playlist contents and providing an option to allow duplicates if the design calls for it.

## Feedback & Persistence
- Provide visual drop indicators (highlight row, insertion line) so users know where the tracks will land.
- Emit toast or inline confirmation when tracks are added, including counts for multi-select drops.
- Ensure playlist updates persist via the existing `LocalMusicState`/settings layer and trigger any playback queue updates.

## Tests & Verification
- Add unit coverage for the playlist mutation logic to confirm order preservation, deduping, and persistence.
- Extend component or integration tests to simulate drag events from media library to playlist and assert resulting state.
- Manually verify drag gestures with single and multi-track selections, including edge cases like empty playlists and long lists requiring auto-scroll.

## Steps
- [x] Confirm drag/drop primitives support cross-panel payloads and extend them for track metadata if needed.
- [x] Add draggable affordances to media library items emitting track payloads.
- [ ] Make the main playlist droppable and handle track insertion logic with persistence.
- [ ] Implement visual feedback and user messaging for successful drops and conflicts.
- [ ] Cover the new flows with automated tests and perform manual verification.
