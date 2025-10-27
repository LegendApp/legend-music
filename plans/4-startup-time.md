## Plan
Reduce perceived startup time by warm-loading cached playlist and library data with `msgpack`, deferring heavy filesystem work until after the UI is interactive, and instrumenting the flow so we can prove the gains.

## Playlist Warm Cache
- Audit the observable(s) that back the primary playlist view (queue, selection state, artwork thumbs) to enumerate the minimal data needed for first paint.
- Implement a fast-path loader in `src/components/Playlist.tsx` (or its hooks) that hydrates from disk synchronously/awaited before render, with a fallback to live fetching if the cache is missing or mismatched.
- Persist that playlist snapshot whenever its source observables change, batching updates with a 1s debounce and scheduling the actual disk write inside a `requestIdleCallback` so we avoid extra pressure on the main thread.
- Ensure cache versioning accounts for schema changes (e.g., include a version field or checksum) so stale data is discarded gracefully.
- Precompute lightweight artwork placeholders (solid color + initials) when full thumbnails are missing, to keep the cached payload compact yet visually stable.

## Library Snapshot Cache
- Identify the data the Library view needs for navigation (tree structure, recent playlists, counts) and mirror it into a second msgpack file under the same plugin.
- Load this snapshot after the playlist view settles, wiring it through existing observables so the UI updates without tearing once fresh scans complete.
- Benchmark loading via `FileSystemNext` (`bytes()` vs streaming) to validate that msgpack stays under budget; if not, split caches per library root.
- Consider recording the last scan timestamp + hash in metadata so we can quickly decide whether to invalidate the snapshot before re-rendering.
- Add a lightweight integration test that mocks `expo-file-system/next` to confirm snapshots hydrate correctly and tolerate missing/invalid files.

## Deferred Library Sync
- Move the expensive `scanDirectory` / metadata hydration calls behind a `requestIdleCallback` or post-first-render effect so the app reaches interactive state before touching the filesystem.
- Gate sync start on cache availability: if either cache fails to load, fall back to the current eager sync path to avoid blank screens.
- Surface a background sync indicator (status bar toast/spinner) so users know the library is updating without blocking first use.
- Profile the deferred sync flow to ensure it does not starve other async work (e.g., player initialization) and tweak concurrency (batch size, throttling) accordingly.

## Supplemental Ideas
- Capture boot-time metrics (`performance.now()`) around cache load, first paint, and sync completion; log them (development only) to validate gains and prevent regressions.
- Convert window registrations to lazy imports so `SettingsContainer` / `MediaLibraryWindow` bundles stay off the critical path, and schedule a `requestIdleCallback` prefetch to warm each chunk after the first render.
- Explore prefetching the playlist cache during app quit/background transitions so the next cold start has fresh data without extra work on launch.
- Investigate whether we can memoize commonly accessed derived data (e.g., sorted playlists) in the cache to avoid recomputing after load.
- Reuse the debounced idle writer utility for other heavy observables (e.g., library filters, hotkey bindings) once the pattern is proven, so we keep IO off the hot path consistently.

## Steps
- [x] Cache the playlist view model with msgpack and synchronous hydration on launch.
- [x] Wire playlist state changes through a debounced idle writer that keeps the cached snapshot current without blocking foreground work.
- [x] Persist a secondary msgpack snapshot for the library tree and hydrate it post-first-render.
- [x] Defer full filesystem sync until caches load and add UX + telemetry to monitor the async work.
- [x] Convert window registrations to lazy imports and prefetch their bundles via `requestIdleCallback`.
- [x] Roll out the idle writer helper to other heavyweight observables (library filters, hotkeys) once validated.
