## Plan
Design a provider plugin system that can power streaming services (Apple Music first, Spotify later) by mapping Apple Music APIs, auth, and playback requirements to Legend Music’s library, queue, and playback flows.

## Current Files & Concepts (No Prior Context Required)
- App shell and persisted UI state: `src/App.tsx`, `src/systems/State.ts`, `src/settings/SettingsContainer.tsx`
- Local music ingestion and playlists: `src/systems/LocalMusicState.ts`, `src/systems/LocalPlaylists.ts`, `src/systems/LibraryState.ts`, `src/systems/LibraryCache.ts`
- Playback controls and player bridge: `src/components/PlaybackArea.tsx`, `src/components/PlaybackControls.tsx`, `src/native-modules/AudioPlayer.ts`, `src/utils/queueActions.ts`
- Media browsing and selection surfaces: `src/media-library/MediaLibraryWindow.tsx`, `src/components/MediaLibrary`, `src/components/PlaylistSelector`
- Settings and cache utilities: `src/systems/Settings.ts`, `src/utils/cacheDirectories.ts`, `src/utils/trackResolution.ts`

## Desired UX
- Apple Music appears as a selectable source, with a sign-in flow and clear indication of the active provider.
- Users can search Apple Music, pull catalog/library metadata, and queue tracks/albums/playlists alongside local content without breaking existing queue behavior.
- Apple Music playback uses the correct entitlements (developer token + user token) and surfaces artwork/Now Playing data consistently with local files.
- Plugin architecture cleanly accommodates Spotify next without reworking core playback or library state.

## Steps
- [ ] Document Apple Music platform requirements: developer token + private key handling, user token flow, MusicKit on macOS, and the REST endpoints needed for catalog search, library fetches, and playback/stream resolution.
- [ ] Define the plugin contract and data model changes: provider capabilities, auth state, track/playlist shape (including provider/source IDs), queue/loading pipeline integration, and persistence points for tokens and cached metadata.
- [ ] Sketch the Apple Music plugin design: module layout (client + auth + playback), expected native bridge needs for MusicKit playback on macOS, request signing/caching strategy, and error/offline handling.
- [ ] Plan UI/UX touchpoints for multi-provider support: settings for provider selection/login, library/search surfaces that can show provider-scoped results, and safeguards when mixing local and streaming items in the queue.

## Validation
- Written investigation notes enumerate required Apple Music endpoints/flows and confirm feasibility on macOS.
- Plugin interface covers Apple Music and is extensible to Spotify, with identified code touchpoints in queue/library/playback.
- Proposed Apple Music module and UI changes allow a small vertical slice (sign-in → search → queue → play) without regressions to local playback.
