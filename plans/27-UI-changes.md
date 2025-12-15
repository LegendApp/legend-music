## Plan
Refresh the playback area to use hover-driven overlays, relocate the timeline, and simplify the title bar chrome.

## Current Files & Concepts (No Prior Context Required)
- Playback layout and controls: `src/components/PlaybackArea.tsx`
- Playlist search/visualizer/library controls: `src/components/PlaylistSelector.tsx`
- Title bar hover chrome and window buttons: `src/components/TitleBar.tsx`
- Button primitives and icons: `src/components/Button.tsx`
- Vibrancy overlay utility: `@fluentui-react-native/vibrancy-view`

## Desired UX
- Show a play/pause button over the album art that appears on hover.
- Add extra vertical padding in the playback area to leave room for window controls.
- On playback hover, show the `PlaylistSelector` controls docked to the top-right of the playback area.
- Title bar has no background; only the window controls fade in on hover, relying on playback padding to avoid overlap.
- Move the playback slider to the right of the album art; the right column stacks artist, title, then timeline vertically.
- On playback hover, show the full playback controls (play/pause, next, etc.) over the artist/title, right-aligned with a vibrancy backdrop.

## Steps
- [x] Restructure `PlaybackArea` layout to add vertical padding, move the timeline to the right column, and prepare overlay hooks.
- [x] Add hover overlays: play/pause on album art plus vibrancy-backed playback controls over artist/title, ensuring layout and hit-testing stay intact.
- [x] Surface `PlaylistSelector` controls at the top-right on hover within `PlaybackArea`, keeping hover/focus behavior consistent.
- [ ] Simplify `TitleBar` to remove the background and rely on fade-in window controls; verify hover interactions across the updated layout.

## Validation
- Manual: hover shows album-art play/pause and right-aligned playback controls; slider/timeline works after layout change; top-right playlist controls appear on hover; title bar window controls fade in without an extra background.
