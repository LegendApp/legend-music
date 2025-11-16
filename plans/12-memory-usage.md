## Plan
Reduce memory footprint and cache size for local library data by trimming serialized fields, avoiding duplicate in-memory structures, and adding guardrails that keep cache growth flat as the library scales.

## Playlist Cache Slimming
- Collapse `SerializedQueuedTrack` to essentials (`filePath`, title/artist/album, duration, thumbnail), deriving `id`/`fileName` at runtime so cached queue entries avoid duplicated strings.
- Remove persistent `queueEntryId` when not needed for restore; rely on `currentIndex` or regenerate entry ids during hydration to shrink snapshots and avoid stale identifiers.

## Library Cache Simplification
- Store only per-track essentials (`filePath`, title, artist, album, duration, thumbnail) and drop duplicate fields (`id`, `fileName`), using `filePath` as the stable key.
- Rebuild artists/albums from tracks on hydrate instead of persisting those derived lists; keep playlists minimal (path + counts) and avoid nested children structures when unnecessary.

## Snapshot Persistence Efficiency
- Replace JSON string diffing in `LibraryState`/`LocalAudioPlayer` with lightweight change detection (hash version or update counters) to avoid allocating giant strings for large libraries.
- Avoid holding multiple full copies of track arrays; prefer shared references or computed selectors instead of cloning to observables when syncing library state.
- Preload large caches lazily and tune `saveTimeout` to coalesce writes during scans so we do not keep multiple copies of large payloads in memory.

## Runtime Memory Hygiene
- Manage the in-memory playlist observable cache (`PlaylistContent`) with limits or LRU eviction so opening many playlists does not leak references.
- Enforce virtualized list rendering and lightweight selectors for large library views to reduce component memory overhead.
- Add cleanup for thumbnail/playlist cache directories to remove orphaned files and stale snapshots before they bloat disk and memory usage.

## Validation & Follow-up
- Migrate caches, then validate queue restore, library hydration, and playlist loading with large datasets to confirm behavior matches current UX.
- Profile heap growth during a large library import and after idle to verify reduced allocations and smaller cache files on disk.
- Run `bun run lint` and `bun run test` after schema changes; include manual QA around cache invalidation and thumbnail loading.

## Steps
- [x] Trim playlist cache schema (drop duplicate ids, avoid persisting queueEntryId where possible) and migrate snapshots.
- [x] Simplify library cache to track-only essentials, rebuild derived collections on hydrate, and version the schema.
- [ ] Swap expensive JSON stringify diffing for lighter change detection and reduce duplicated arrays in observables.
- [ ] Add cache/file cleanup and tuned persistence (msgpack/eviction/lazy preload) to keep disk/memory growth bounded.
- [ ] Validate migrations and measure memory/cache size improvements with profiling and regression tests.
