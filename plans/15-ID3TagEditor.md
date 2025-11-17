## Plan
Assuming the native-first scanning from plans/14-native-id3.md is complete, use ID3TagEditor for MP3 tags plus a lightweight duration probe to make metadata reads as fast as possible, and add a native ID3 writer surface.

## Native Metadata Reader (macOS/iOS)
- Add ID3TagEditor to the macOS target (SPM or vendored) and gate usage to MP3s; keep AVFoundation fallback for other formats and the existing native scan pipeline.
- Read title/artist/album/artwork via ID3TagEditor without instantiating full AVURLAsset; handle multiple APIC frames by picking the primary image.
- Keep artwork thumb caching (square resize, deterministic hash key, stored in cacheDir) and return only the cached URI + artwork key.
- For duration, use a minimal probe (e.g., AVURLAsset requesting only duration or AudioFileGetProperty estimated duration) on a background queue; avoid full metadata loading.
- Preserve the existing native batched scan flow and error isolation so one bad file does not halt the scan.

## Native Metadata Writer
- Expose a bridge method to write basic ID3 fields (title, artist, album, artwork) using ID3TagEditor for MP3s; return explicit errors for unsupported formats.
- Ensure writes are done off the main thread, validate file existence, and consider atomic writes or backups if the library supports it.
- Keep artwork handling aligned with the reader (single primary image) and validate size/type before writing.

## Native/JS Integration
- Update the native scan/metadata path to use ID3TagEditor for MP3s and the minimal duration probe; keep the current native code for other formats.
- Continue returning the existing MediaTags shape so JS consumers stay stable; JS changes should be limited to the new writer surface.
- Add a JS helper for writing tags via the new native method, leaving integration points (e.g., edit flows) ready but guarded.
- Keep scan batching/progress unchanged; capture and log native errors quietly to avoid breaking scans.
- Pass a skip set of already-known tracks (root + relative path) into native scan so metadata/artwork extraction is skipped for files we already have cached.

## Validation
- Benchmark per-file metadata read time before/after for a small MP3 set (cold/warm cache) and confirm noticeable speedup.
- Manually verify fields and artwork on varied MP3s (v2.3/v2.4, multiple APIC frames); ensure duration is accurate.
- Add/extend tests where feasible (fixtures) for read/write paths; run lint/tests if possible before shipping.

## Steps
- [x] Add ID3TagEditor to the macOS target with minimal build/config overhead.
- [x] Implement the native reader using ID3TagEditor + minimal duration probe inside the existing native scan pipeline and expose it via the AudioPlayer bridge.
- [x] Keep non-MP3 formats on the current native path, preserving artwork caching and batched results to JS.
- [x] Implement a native ID3 write API for basic fields and bridge it to JS with clear error handling for unsupported cases.
- [x] Send a skip set of known tracks (root + relative path) into native scan so existing files are skipped without re-reading metadata.
- [ ] Validate performance and correctness (benchmarks/manual checks/tests) and update docs as needed.
