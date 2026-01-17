## Plan
Add an Apple Music provider plugin backed by a native MusicKit bridge. It should support catalog search, library
playlists, and in-app playback with user sign-in, plus a settings page with enable/disable and sign-in controls.
Developer token will be fetched from a backend endpoint placeholder (TEMPORARY_URL) with a TODO for wiring.

## Research Notes
- `src/providers/pluginRegistry.ts` defines `ProviderPlugin` (provider/search/playback/library/ui/tracks).
- `src/providers/setupProviders.ts` registers plugins (local/spotify/youtubeMusic).
- `src/components/JumpSearchMenuDropdown.tsx` consumes registered search providers for the jump menu.
- `src/components/MediaLibrary/Sidebar.tsx` and `src/components/MediaLibrary/useLibraryTrackList.ts` use
  plugin library hooks (`playlists$`, `listPlaylistTracks`) to render provider playlists.
- Spotify/Youtube Music providers show patterns for auth state, playback bridges, search, playlists, and settings UI.

## Provider Scope
- Provider ID: `"appleMusic"` with `supportsSearch`, `supportsLibrary`, `supportsPlayback` true.
- Library playlists and tracks via MusicKit API (library endpoints), mapped to `ProviderPlaylist`/`ProviderTrack`.
- Search via MusicKit catalog search with storefront from user account.
- Playback via native MusicKit bridge; no WebView requirement.
- Settings page with enable toggle, sign-in/out, and auth status (subscription required).

## Native Bridge Notes
- Add a native module under `src/native-modules/` + `macos/` that wraps MusicKit:
  - initialize with developer token fetch + user token
  - authorize user, expose user/session details and storefront
  - control playback (load/play/pause/seek/volume) and send state updates
- Add macOS entitlements/config changes required for MusicKit (sign-in, music user token access).

## Steps
- [x] Create `src/providers/appleMusic/` with auth state, token fetch (TEMPORARY_URL TODO), provider session,
      and model mapping utilities.
- [x] Implement library playlists + tracks fetch with caching/status (`state.ts`, `playlistsState.ts`, `playlists.ts`).
- [x] Implement catalog search provider for jump menu (search.ts + isEnabled$).
- [x] Implement native MusicKit bridge + playback provider, plus track mapping to `LocalTrack`.
- [ ] Build Apple Music settings page (enabled toggle, sign-in/out, status) and source badge.
- [ ] Register the plugin in `src/providers/setupProviders.ts` and export from `src/providers/index.ts`.

Validation: Launch app, enable Apple Music, complete sign-in, verify playlists populate, search works in jump menu,
and playback controls operate on Apple Music tracks via the native bridge.
