## Plan
Enable local-library-only AI playlists by generating a `medialibrary.csv` file alongside `mediaLibrary.json`
from the library cache and adding a "Local Library" AI search provider that uses the CSV to resolve AI suggestions.

## Research Notes
- `src/systems/LibraryCache.ts` owns `libraryCache$` updates and snapshot persistence (CSV should live next to
  `mediaLibrary.json`).
- `src/systems/Settings.ts` and `src/systems/suggestions/service.ts` gate AI features via `settings$.ai`.
- `src/systems/ai/prompts.ts` + `src/systems/suggestions/ai/aiProvider.ts` build AI prompts and execute commands.
- `src/systems/ai/resolver.ts` uses search providers to resolve AI-suggested tracks.
- `src/providers/search/types.ts` + `src/providers/search/registry.ts` define/register search providers.
- `src/providers/local/search.ts` shows the local library search shape to mirror.
- `src/settings/AISettings.tsx` lists preferred search providers in the AI settings UI; "Local Library" should be
  a selectable preferred service (not a hard restriction).

## Steps
- [x] Add a CSV writer that exports the local library snapshot to `medialibrary.csv` (same directory as
      `mediaLibrary.json`) with `artist,title,album,year,genre` columns; fill missing fields consistently and
      escape commas/quotes.
- [ ] Subscribe to `libraryCache$` updates to regenerate `medialibrary.csv` only when
      `settings$.ai.enabled` and `settings$.ai.playlistCreation` are true; debounce updates as needed.
- [ ] Create a "Local Library" AI search provider that prompts the AI with `medialibrary.csv` and converts its
      response into `SearchResult` entries for local tracks.
- [ ] Register the new search provider and wire it into AI resolution so it is selectable as the preferred
      service; ensure AI queue extension uses the same preferred-service logic.
- [ ] Add coverage for CSV generation and AI resolution with the local provider, plus any prompt/telemetry
      updates needed for the new flow.

Validation: Trigger a library cache update and confirm `medialibrary.csv` regenerates only when AI playlist
creation is enabled; verify the "Local Library" provider appears in AI settings as a selectable preferred
service; generate an AI playlist and confirm suggestions can resolve to local tracks using the preferred
service selection (including queue extension).
