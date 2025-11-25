## Plan
Trim startup latency by reducing duplicate persistence loads, deferring non-critical hydration, and adding focused timing probes to spot remaining bottlenecks.

## Persistence Hygiene
- Identify and dedupe repeated `createJSONManager` preloads (settings, theme, hotkeys) so each table initializes once.
- Gate non-essential cache loads (library UI, localMusicSettings) behind interactions or first layout to keep paint fast while keeping queue hydration startup-blocking so playlists render immediately.
- Add `sinceStartMs` to `Persist.preload`/`Persist.loadTable` logs to see which loads happen before first paint and reorder as needed.

## Playback/Queue Timing
- Keep queue hydration blocking for playlist display, but delay initial track load until after first render or user action when possible.
- Add timing marks for queue hydration and first track load to measure their impact on startup.
- Check native bridge churn (Skia init, AudioPlayer setup) for synchronous work and gate heavy paths until after layout if possible.
- Ensure file watcher scans (e.g., `localMusicSettings.autoScanOnStart`) do not trigger before the UI is ready.

## Steps
- [x] Remove duplicate store preloads and ensure single instantiation paths.
- [x] Defer non-critical cache hydration and initial track loading until after first layout/interaction while keeping queue hydration ready for playlist rendering.
- [x] Add targeted perf marks (including `sinceStartMs` in persist logs) around queue hydration and first track load to validate improvements.
- [ ] Audit native init (Skia/AudioPlayer) and file watcher auto-scan triggers to avoid synchronous work before UI is ready.
