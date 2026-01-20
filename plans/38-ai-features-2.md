## Plan
Improve the AI playlist creation flow so it fills the current playlist, shows progress in the playlist view, resolves
Apple Music metadata correctly, logs AI outputs for debugging, and adds a Preferred Service setting for AI track sourcing.

## Research Notes
- `src/components/MediaLibrary/AiPlaylistDropdown.tsx` handles the AI playlist prompt and creation flow.
- `src/components/MediaLibrary/TrackList.tsx` renders empty states and playlist content; good place for a spinner.
- `src/components/MediaLibrary/useLibraryTrackList.ts` builds track items from playlists and providers.
- `src/systems/suggestions/ai/aiProvider.ts` executes AI commands and resolves tracks.
- `src/systems/ai/resolver.ts` resolves AI suggestions into playable tracks and providers.
- `src/providers/appleMusic/` includes mapping utilities and metadata needed for Apple Music tracks.
- `src/settings/AISettings.tsx` renders AI settings; `src/systems/Settings.ts` defines AI settings schema.

## Steps
- [x] Update AI playlist creation to add tracks into the currently selected local playlist instead of creating a new one,
      including UX copy changes to reflect "fill current playlist" behavior.
- [x] Add an in-playlist progress indicator while AI suggestions are generating/resolving, shown in the track list view
      after closing the popup, and clear it on completion or error.
- [x] Fix Apple Music track metadata resolution so titles/artists display correctly instead of the raw track id string,
      ensuring resolved tracks include proper metadata for playlist display.
- [x] Add detailed console logging of the AI prompt output and the subsequent resolve-to-tracks results to aid debugging.
- [ ] Add a Preferred Service setting in the AI settings page and wire it into the AI track resolver to bias sources.

Validation: Trigger AI playlist creation on an empty local playlist, confirm the popup closes, spinner shows until
tracks appear, Apple Music tracks render with correct metadata, logs print AI output + resolved results, and the
Preferred Service setting affects the chosen source.
