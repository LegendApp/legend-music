## Plan
Add AI-assisted queue extension and AI playlist creation using locally available CLI tools (Claude Code or Codex).
When the queue reaches the last song, the app should call the AI with the last 10 songs as context and enqueue
10 new tracks. The media library should add a button that opens a prompt dialog for AI-generated playlists.

## Research Notes
- `src/components/AudioPlayer.tsx` holds queue state, playback controls, and the `playNext` logic that determines
  end-of-queue behavior.
- `src/components/Playlist.tsx` renders the active playback queue and exposes queue actions.
- `src/components/MediaLibrary/Sidebar.tsx` owns the playlist header row and "Add playlist" button.
- `src/components/SavePlaylistDropdown.tsx` shows an example of a dropdown dialog with a text input + actions.
- `src/providers/pluginRegistry.ts` + `src/providers/setupProviders.ts` define search-capable providers.

## AI Integration Notes
- Add a macOS native module that can run CLI tools (`claude`, `codex`) and return stdout/stderr to JS.
- Expose `isAvailable`, `runPrompt`, and `preferredTool` in `src/native-modules/`.
- Standardize prompts to return JSON with track title/artist pairs (and optional album) so parsing is reliable.

## Feature Scope
- Auto-extend queue:
  - Detect when `currentIndex` moves to the final queue entry (and repeat mode is off) and trigger AI fetch.
  - Use the last 10 queued tracks as context, request 10 new tracks, resolve them via provider search, and append.
  - Avoid duplicates already in the queue; guard with a "fetch in progress" flag.
- AI playlist creation:
  - Add a "Create with AI" button in the media library playlist header.
  - Show a prompt dialog (text input + create/cancel) and create a local playlist with AI results.
  - Resolve track suggestions, add matching tracks, and report any unresolved items in a toast.

## Steps
- [x] Add an AI CLI native module (`src/native-modules/AICommandRunner.ts` + macOS implementation) to detect and
      execute `claude`/`codex` commands with structured JSON responses.
- [x] Create a shared AI service (`src/systems/ai/`) that builds prompts, parses responses, and resolves tracks
      through provider search (fall back to local library first).
- [ ] Wire queue auto-extension in `src/components/AudioPlayer.tsx` (or a new queue watcher) with in-flight guards,
      duplicate filtering, and error toasts.
- [ ] Add the media library "Create with AI" dialog (likely alongside `SavePlaylistDropdown` patterns) and call the
      AI service to create a local playlist and populate it.
- [ ] Add settings/feature flags and status indicators for AI availability so the UI can disable buttons when no CLI
      is installed.
- [ ] Add tests for AI response parsing and track resolution helpers; update mocks for the AI native module.

Validation: Run the app, play through a queue to the last item, confirm auto-append of 10 new tracks, and verify
the media library AI playlist dialog creates a playlist with resolved tracks and handles missing CLI gracefully.
