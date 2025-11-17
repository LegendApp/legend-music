## Plan
Move ID3 parsing and artwork extraction into a native module to reduce JS CPU and avoid DataView errors during scans.

## Native Metadata Reader (macOS/iOS)
- Implement a native bridge that reads title/artist/album/duration/artwork via AVAsset/AudioToolbox for local files.
- Include artwork extraction (APIC/common artwork), downscale/crop to a square (e.g., 128×128), and write to disk; return only a file URI.
- Expose a method like `getTags(path, cacheDir)` that returns `{ title?, artist?, album?, durationSeconds?, artworkUri? }` or a defined error.
- Use a stable cache key (hash of path+descriptor) and ensure the native helper creates the provided cacheDir and intermediates.
- Do native work off the main thread and batch progress/updates back to JS.

## JS Integration
- Wire LocalMusicState to call the native reader first (passing the shared cache directory) and fall back to filename parsing if needed.
- Treat returned artworkUri as the cached thumbnail; avoid base64 handling in JS.
- Keep JS error handling quiet and continue scanning on failures.
- Plan native-first scanning: move directory traversal + metadata/artwork extraction fully into native, batching results back to JS to reduce bridge overhead.
- Update library cache data shape to store only file name (not full path) where possible, adjusting consumers accordingly.
- Store thumbnail keys as deterministic hashes (no full path in cache) and reconstruct full thumbnail URIs (thumbs root + hash + .png) in code.
- Add library roots array to cache and store relative paths with a root index to shrink stored paths and speed loading.

## Validation
- Scan a library with varied MP3s (with/without artwork) and confirm titles/artist/album/duration populate correctly.
- Verify artwork thumbs are written to the cacheDir and no DataView/ID3 errors appear during scanning.
- Run lint/tests if feasible after changes.

## Steps
- [x] Add native metadata reader (metadata + artwork) using AVAsset/AudioToolbox.
- [x] Bridge to JS and integrate into LocalMusicState scanning pipeline.
- [x] Cache artwork thumbs and verify scan flow is stable without RangeErrors.
- [ ] Move directory traversal + metadata extraction fully native with batched results back to JS.
- [x] Move directory traversal + metadata extraction fully native with batched results back to JS.
    - [x] Add native scan API (walk directories, extract metadata/artwork, batch results).
    - [x] Wire JS scan flow to consume native batches and update state/progress.
- [ ] Update library cache to store only file names (not full paths) and adjust consumers.
    - [ ] Persist library roots array and store relative paths with root index.
    - [ ] Persist thumbnail hash/key (no full path) and reconstruct thumbnail URIs in code.
    - [ ] Update load/save/hydration to use the new schema and drop full paths from cache.
