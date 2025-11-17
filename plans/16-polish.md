## Plan
Polish the app for first public release by tightening stability, handling edge cases, surfacing recovery tools, and closing gaps in credits and file handling.

## Stability & Tests
- Ensure `tsc`, lint, and jest suites run clean; add coverage for LocalMusicState/LibraryState flows, playlist/library caches, playback controls, and overlay/hotkey interactions.
- Add regression tests for file import/update paths (duplicates, missing files) and ID3 read/write helpers.
- Gate new work behind modest perf budgets to avoid slowing scans or UI.

## Crash/Offline Handling
- Harden behaviors when library roots are missing, files are deleted, caches are corrupted, or the native bridge rejects requests; keep the UI responsive with clear recovery prompts.
- Add guardrails for network-less scenarios (e.g., no remote album art) and for corrupted/partial ID3 data.

## Settings & Recovery
- Expose cache clear/reset and library rescan actions in Settings with confirmation and progress feedback.
- Surface build/version info and a link to report issues to help support.

## Open Source Credits
- Audit dependencies used in-app (native + JS) and update the Open Source settings page to include any missing libraries.

## File Handling & ID3 Safety
- Surface friendly errors for ID3 read/write failures; keep unsupported formats explicit.
- Ensure file dialogs and paths handle special characters/long paths; normalize paths to avoid duplicates and guard against importing the same track multiple times.
- Keep artwork handling safe (size/type validation, fallbacks) and avoid blocking the main thread during file operations.

## Steps
- [x] Stabilize builds: run `tsc`, lint, and tests; add/adjust tests to cover critical flows (library/playlist state, playback controls, import edge cases, overlay/hotkeys).
- [x] Handle crash/offline cases: add guards for missing files/roots, cache corruption, bridge errors, and degraded metadata; keep UX responsive with recovery messaging.
- [x] Settings polish: add cache clear/reset and library rescan toggles with confirmations and status feedback; include version/build info and issue-report entry.
- [x] Open Source page audit: inventory runtime deps and add any missing credits to the Open Source settings view.
- [x] File handling hardening: improve ID3 error messaging, support special characters/long paths in dialogs, and prevent duplicate imports while keeping artwork handling safe.
