## Plan
Add a first-class AI source selection (streaming service vs local library) in settings and prompt UI, and wire it
through the suggestion pipeline so prompts, resolution, and playlist metadata respect the chosen source.

## Research Notes
- `src/settings/AISettings.tsx` renders AI settings, including the suggestion provider and preferred service dropdown.
- `src/systems/Settings.ts` defines persisted AI settings (`enabled`, `autoExtendQueue`, `suggestionProviderId`,
  `preferredTrackProviderId`) and is the place to add a default AI source setting.
- `src/systems/suggestions/types.ts` defines `SuggestionRequest` and `SuggestionProviderId`; a new field is needed to
  carry the source selection through AI requests without overloading the existing `source: "auto" | "manual"`.
- `src/systems/suggestions/ai/aiProvider.ts` builds prompts, injects the local library CSV, and restricts provider
  resolution based on `preferredTrackProviderId`.
- `src/systems/ai/prompts.ts` provides the prompt builders that accept an optional local library CSV constraint.
- Prompt entry points live in `src/components/MediaLibrary/AiPlaylistDropdown.tsx`,
  `src/components/QueueAiDropdown.tsx`, `src/components/MediaLibrary/TrackList.tsx` (extend prompt),
  and `src/components/MediaLibrary/Sidebar.tsx` (edit/regenerate prompt).
- AI playlist metadata is stored in `src/systems/LocalMusicState.ts` and `src/systems/LocalPlaylists.ts`, serialized via
  `src/utils/m3u.ts` tags (`aiPrompt`, `aiSummary`) so a new `aiSource` field needs to persist alongside them.
- Search/provider enablement is determined in `src/providers/search/registry.ts` (`enabledSearchProviderIds$`) and
  `src/providers/streamingProviderRegistry.ts`; the source dropdown should filter to enabled services plus Local Library.

## Steps
- [ ] Add a new AI source setting (e.g., `settings$.ai.promptSource`) with a default, and surface it in AI settings with
      copy that makes the distinction between streaming service AI prompts and local library prompts explicit.
- [ ] Extend `SuggestionRequest` with a dedicated source field (not the existing `source: "auto" | "manual"`) and update
      the AI provider pipeline to choose the library CSV and resolution restriction based on the request override or
      settings default.
- [ ] Update AI prompt UI entry points (queue, playlist, extend/regenerate) to include a source selector, pass the chosen
      source to `fetchSuggestions`, and align prompt placeholders/labels with the selection.
- [ ] Persist the selected source on AI playlists (add `aiSource` to `LocalPlaylist` metadata and M3U tags), and reuse it
      when extending/regenerating from existing prompts; fallback to settings default for legacy playlists.
- [ ] Update the source-related settings dropdown to list only enabled services plus "Local Library", reusing
      `enabledSearchProviderIds$` (or equivalent) to filter unavailable services while always keeping Local Library visible.

## Validation
Confirm settings show the source selector and filtered service list; AI prompt dialogs allow source selection; local
library prompts constrain to the library and service prompts use streaming resolution; existing AI playlists keep
working and store/reuse `aiSource`.
