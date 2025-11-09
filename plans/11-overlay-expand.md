## Plan
Provide a dedicated overlay mode for `PlaybackArea` that collapses transport UI until the overlay is hovered, then fades controls in and expands the window to fit the slider.

## Overlay Playback Mode Wiring
- Add a prop or context flag on `src/components/PlaybackArea.tsx` enabling “overlay compact mode,” keeping default behavior unchanged elsewhere.
- Have `CurrentSongOverlayController`/`CurrentSongOverlayWindow` pass the flag only for the overlay surface and centralize hover state there.

## Hidden UI Layout
- Wrap the CurrentTime, CustomSlider, CurrentDuration, and `playbackControlsLayout` containers in a collapsible group that hides (opacity 0, pointer disabled, height collapsed) while in compact mode and not hovered.
- Ensure spacing/gaps collapse gracefully so the overlay shows only minimal affordances (e.g., artwork + primary button) when hidden.

## Hover Reveal & Animations
- Listen for mouse enter/leave on the overlay window to toggle a hover state, fading the hidden group in/out via `react-native-reanimated` opacity/translate transitions.
- Drive the transitions with Reanimated shared values/worklets so timing stays smooth and reversible while remaining in sync with the overlay window.

## Overlay Window Resizing
- When the hover state reveals controls, animate the overlay window height to accommodate the slider/time row, and shrink back when hidden.
- Update the overlay sizing logic to avoid layout jumps (e.g., use springs or eased height transitions) and ensure minimum size constraints are respected.

## Validation & Follow-up
- Verify the standard app window remains unchanged, while the overlay exhibits the compact-to-expanded behavior.
- Add or outline tests/manual QA steps covering hover transitions, resizing, and regression checks for playback interactions.

- [x] Introduce overlay compact mode prop/context and wire it from overlay components.
- [x] Hide time/slider/controls group when compact and idle.
- [x] Implement hover state transitions that fade controls in/out.
- [ ] Animate overlay window size alongside the control reveal.
- [ ] Validate behavior and document test coverage/manual QA.
