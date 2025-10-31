## Plan
Deliver a compact `CurrentSongOverlay` window that reuses the existing `PlaybackArea`, floats near the top-center of the screen, and fades in with a blur when new songs start before auto-dismissing a few seconds later.

## CurrentSongOverlay Window
- Add a dedicated macOS window module wired into the multi-window registry that renders only the `PlaybackArea` component with minimal chrome.
- Ensure default sizing stays small enough for quick-glance metadata and transport controls without overlapping key UI in the main window.
- Position the window in the top-center of the primary display, honoring macOS safe areas and user-adjusted offsets if we persist placement.
- Keep the window hidden by default and expose programmatic show/hide controls for event-driven display.

## Playback Triggers
- Subscribe to the playback observable or event bus already used for track changes and fire the overlay whenever a new song begins (e.g., when `currentTrack.id` changes while playing).
- Reset any previous hide timers before re-showing so rapid track changes keep the overlay visible for the full duration.
- Respect app lifecycle—avoid presenting while the main app is backgrounded or playback is paused/stopped.

## Animation & Blur
- Implement the appear transition starting at `opacity: 0` with a strong blur radius, easing to full opacity and zero blur over ~300ms.
- Mirror the exit animation by increasing the blur and fading out before finally hiding the window to prevent visual popping.
- Use React Native Reanimated or the existing animation helper to ensure smooth GPU-accelerated transitions and interruptible sequences.

## Settings Integration
- Add an `Overlay` section to the settings pane with toggles for `Enabled`, a numeric `Display duration` (seconds, default `5`), and a `Position` control supporting top/middle/bottom × left/center/right.
- Persist settings via the shared preferences store so changes affect future overlay activations without requiring a restart.
- Update any settings schema/types to include the overlay fields and surface defaults in migrations or initial state.

## Steps
- [x] Implement the `CurrentSongOverlay` window and render the existing `PlaybackArea`.
- [ ] Animate show/hide with blur + opacity transitions tied to track start events.
- [ ] Expose overlay configuration options under Settings ▸ Overlay with enable, duration, and position controls.
