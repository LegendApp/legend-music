## Plan
Further reduce playback memory spikes by shrinking artwork payloads, tightening AVPlayer buffering, and re-checking playback-time allocations (excluding the visualizer).

## Artwork Downscaling
- Crop embedded artwork to a centered square and downscale to 128×128 before caching, so playback never decodes full-size images.
- Keep cache writes lightweight and predictable (PNG/WebP), ensuring thumbnails are ready before playback uses them.

## Player Buffering Tweaks
- Clamp AVPlayer forward buffering for local files to only a few seconds and keep stalling mitigation on, avoiding oversized in-memory buffers during playback.

## Playback Memory Review (No Visualizer)
- Inspect other playback-time allocators (now playing updates, queue hydration, album art surfaces) and outline any further easy wins to keep steady-state memory low.
- Notes: keep playback-time artwork usage limited to cached 128px thumbnails, avoid re-hydrating queue state per track change, and prefer shared refs for now-playing/overlay artwork surfaces.

## Validation
- Play tracks with large and small embedded artwork and confirm thumbnails are cached at 128×128 with no runtime artwork decoding.
- Verify playback starts smoothly and memory settles without large spikes after the initial buffer fills.
- Run lint/tests if feasible after changes.

## Steps
- [x] Downscale cached artwork to centered 128×128 thumbnails.
- [x] Limit AVPlayer forward buffering and keep stalling mitigation enabled.
- [x] Document remaining playback-time memory considerations (visualizer excluded).
