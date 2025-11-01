## Plan
Smooth the first-run experience so new users understand how to add music, see a friendly default playlist, and can play dragged-in tracks even without a configured library.

## First-Run Messaging
- Replace the ambiguous empty-state copy in `src/components/Playlist.tsx` (and related overlays) with guidance to drag folders or open library settings.
- Add an affordance (CTA button or link) that opens Library Settings so users can browse for a folder instead of relying solely on drag-and-drop.
- Highlight the drop zone visually on hover/first use to reinforce the “drag here” instruction.

## Default Playlist Naming
- Rename the implicit `"Local Files"` playlist to a friendlier name (e.g., `"All Songs"`) in `src/components/PlaylistSelector/hooks.ts`, UI placeholders, and any persisted state helpers.
- Provide lightweight migration/compat logic so existing `"LOCAL_FILES"` entries are displayed with the new label without breaking saved queues.
- Audit icons/tooltips so the label update propagates everywhere (library nav, overlays, settings).

## Library-Free Usage
- Ensure dropping individual tracks works end-to-end when no library directories are configured (queue logic, metadata hydration, playback).
- Guard playlist resolution paths in `LocalMusicState`/`PlaylistSelector` so they do not assume a configured library or populated playlists array.
- Surface friendly feedback after a successful drop (toast/snackbar) and suggest creating a library for persistent playback.

## Validation & Follow-up
- Add unit coverage (or document manual QA) for the renamed default playlist and drag-in-first-track behavior.
- Capture future onboarding ideas: quick start modal, sample playlist option, or guided tour entry tucked into `plans/bugs.md` or roadmap.

## Steps
- [x] Update first-run empty-state copy and add Library Settings affordance.
- [x] Rename default playlist label and migrate dependent UI/state.
- [x] Verify drag-and-drop playback path works without library configuration and add regression coverage.
