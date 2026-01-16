## Plan
Add a limited YouTube Music plugin (alongside Spotify) that implements a base provider interface with optional
capabilities, supports search via the YouTube Data API, and plays tracks by ID through a hidden
music.youtube.com WebView while emitting playback state changes like Spotify.

## Research Notes
- Spotify playback uses a hidden WebView and emits state via provider events; mirror this architecture.
- Provider enablement and auth/live state are managed under `src/providers/` and related observables.
- Search result mapping should reuse the existing provider-to-`LocalTrack` pipeline for queueing.
- macOS bridge work should stay in `macos/` if required.

## Provider Scope
- Implement the plugin base interface; optional capabilities are allowed.
- No library sync or browsing (not a data source, does not populate media library).
- Search only (YouTube Data API).
- Playback only by ID, opening `https://music.youtube.com/watch?v=<id>` in a hidden WebView.
- Emit playback events (play/pause/position/track end) in the same shape Spotify expects.

## Integration Design Considerations
- Add a YouTube Music plugin entry alongside Spotify using the shared provider base interface.
- Define optional capability flags (search, playback, data source) and ensure UI/flows respect missing features.
- Store YouTube API key/config in the same settings flow used by other provider credentials.
- Build a `ProviderTrack` -> `LocalTrack` mapper for YTM search results.
- WebView controller should expose play/pause/seek and emit state via injected JS message bridge.
- Ensure cleanup when switching providers or closing the player.

## Suggested Module Additions
- `src/providers/base/` (or extend existing) for the shared plugin/provider interface with optional capabilities.
- `src/providers/youtubeMusic/` for provider config, search, playback, and track mapping.
- `src/providers/youtubeMusic/search.ts` to call the YouTube Data API and normalize results.
- `src/providers/youtubeMusic/player.ts` (or similar) to host hidden WebView playback and event bridging.
- `src/providers/youtubeMusic/types.ts` for API response shapes and provider types.

## UI/Interaction Notes
- Show YouTube Music as a provider option with minimal settings (API key).
- It should not appear as a library/source provider (no media library views).
- Search results should show a YouTube Music badge/icon if other providers do.
- Playback state should update the same UI surfaces as Spotify.

## Steps
- [x] Add shared provider base interface with optional capabilities; update Spotify to conform.
- [x] Add YouTube Music plugin skeleton, enablement state, and settings wiring.
- [ ] Implement YouTube Data API search and map results to provider tracks.
- [ ] Add hidden WebView playback for music.youtube.com and bridge playback events.
- [ ] Wire play/pause/seek commands through the provider interface.
- [ ] Hook search results into existing UI and add provider badges while excluding YTM from library sources.
- [ ] Validate playback state changes and cleanup on provider switch/close.

Validation: Configure an API key, search for a track, play a result, and confirm playback events mirror Spotify
(playing/paused/time updates/ended) while the WebView stays hidden.
