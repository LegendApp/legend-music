## Plan
Centralize supported audio formats across JavaScript and macOS native code so drag/drop, dialogs, and library scanning all respect the same whitelist while documenting AVFoundation coverage.

## Format Sources of Truth
- Define a canonical list of supported audio extensions (mp3, wav, m4a, aac, flac) exposed from a shared JS module with notes on AVFoundation compatibility and any potential additions.
- Mirror the same list natively for drag/drop, open/save panels, and media scanning to avoid format drift between layers.

## App Surfaces
- Route drag/drop acceptance, file dialogs, and playlist imports through the shared format list instead of hardcoded arrays.
- Ensure library scans and metadata parsing accept the shared formats and avoid mp3-only filename parsing quirks.

## Validation & Follow-up
- Extend or add tests around scan filtering and playlist drop handling for the supported formats.
- Capture any AVFoundation-supported formats we choose not to enable yet and document rationale for future expansion.

## Steps
- [x] Establish shared audio format constants for JS, document AVFoundation support, and use them for drag/drop + dialog defaults.
- [ ] Update JS library ingestion (LocalMusicState, playlist drop/import) to rely on shared formats and avoid mp3-only parsing.
- [ ] Align macOS native drag/drop and media scanning to the shared format list; ensure metadata extraction uses it.
- [ ] Add or adjust tests and sanity checks covering filtering across the supported formats.
