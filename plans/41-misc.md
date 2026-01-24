## Plan
Tighten AI settings and invocation plumbing, and expand the sidebar to list connected provider plugins and their
playlists.

## Research Notes
- `src/settings/AISettings.tsx` renders the AI settings rows, including the Playlist Creation toggle and Provider
  Status label.
- `src/systems/Settings.ts` owns the `settings$.ai.playlistCreation` flag and it is referenced throughout AI
  gating and UI (`src/systems/suggestions/service.ts`, `src/components/MediaLibrary/Sidebar.tsx`,
  `src/components/MediaLibrary/AiPlaylistDropdown.tsx`, `src/components/QueueAiDropdown.tsx`,
  `src/providers/localLibrary/search.ts`, `src/systems/ai/libraryCsv.ts`).
- `src/components/MediaLibrary/Sidebar.tsx` currently renders provider playlists only for the active provider.
- `src/providers/pluginRegistry.ts` and `src/providers/streamingProviderRegistry.ts` expose streaming provider
  plugins and sessions needed to render sidebar sections for each connected provider.
- `src/systems/ai/summary.ts` duplicates AI invocation args that already exist in suggestion provider configs
  (`src/systems/suggestions/providers/*.ts`).

## Steps
- [ ] Remove the Playlist Creation toggle and delete the `settings$.ai.playlistCreation` flag; update settings
      schema usage and any gating that still checks `settings$.ai.playlistCreation`.
- [ ] Remove the Provider Status row from AI settings along with any unused availability label state derived only
      for that row.
- [ ] Refactor the sidebar to iterate over streaming provider plugins and render a playlist section for each
      connected provider; skip providers without an authenticated session.
- [ ] Centralize AI invocation building (reuse suggestion provider invocation) and update `summary.ts` to use it,
      trimming duplicated command/args logic.
Validation: Verify AI settings no longer show Playlist Creation or Provider Status; AI playlist creation still
works when AI is enabled; sidebar shows playlists for each connected provider and omits disconnected providers;
summary generation still works for each AI tool.
