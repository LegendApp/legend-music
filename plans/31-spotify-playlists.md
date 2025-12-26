## Plan
Show Spotify playlists in the media library when the Spotify provider is enabled, with proper selection and track listing behavior.

## Research Notes

## Current Media Library Flow
- `MediaLibrarySidebar` in `src/components/MediaLibrary/Sidebar.tsx` renders playlists from `localMusicState$.playlists` and uses `libraryUI$.selectedPlaylistId` for selection; the same logic is duplicated for native and non-native sidebars.
- `useLibraryTrackList` in `src/components/MediaLibrary/useLibraryTrackList.ts` builds the track list from `library$.tracks` (local library) and, for playlist view, resolves `selectedPlaylistId` against `localMusicState$.playlists`.
- `TrackList` in `src/components/MediaLibrary/TrackList.tsx` derives the playlist header info from `localMusicState$.playlists` and uses `libraryUI$.selectedPlaylistId`.
- Playlist editing and drag/drop are gated by `playlist.source === "cache"` and `playlist.filePath` in `MediaLibrary/Sidebar.tsx`, `MediaLibrary/TrackList.tsx`, and `MediaLibrary/useLibraryTrackList.ts`.
- `libraryUI$` in `src/systems/LibraryState.ts` only tracks `selectedView`, `selectedPlaylistId`, `searchQuery`, `playlistSort` (no provider/source info today).

## Spotify API + Scopes
- Existing scopes in `src/providers/spotify/constants.ts` include `playlist-read-private`; Spotify also has `playlist-read-collaborative` if collaborative playlists need to be listed.
- Playlist list endpoint: `GET https://api.spotify.com/v1/me/playlists?limit=50&offset=...`.
- Playlist tracks endpoint: `GET https://api.spotify.com/v1/playlists/{playlist_id}/tracks?limit=100&offset=...` (track can be null; handle removals/unavailable).
- Auth/token flow is already in `src/providers/spotify/auth.ts` and `ensureSpotifyAccessToken` should be reused for API calls.

## Data Shapes + Playback Constraints
- `ProviderPlaylist` and `ProviderTrack` are defined in `src/providers/types.ts`; map Spotify responses into these shapes.
- `LocalAudioPlayer` treats Spotify tracks when `track.provider === "spotify"` and expects `uri` and `durationMs` (see `src/components/LocalAudioPlayer.tsx`); `playSpotifyUri` only accepts a list of track URIs.
- For playlist tracks, build `LocalTrack`-shaped objects with `provider: "spotify"`, `filePath: uri`, `uri`, `durationMs`, `thumbnail`, and a formatted `duration` string (`formatSecondsToMmSs` in `src/utils/m3u.ts`).

## Integration Design Considerations
- Selection needs to distinguish local vs Spotify playlists. Options:
  - Prefix IDs like `spotify:${playlistId}` and detect prefix in `useLibraryTrackList`/`TrackList`.
  - Extend `libraryUI$` with a `selectedPlaylistSource` or `selectedPlaylistProvider` field.
- Spotify playlists must be read-only: keep `isPlaylistEditable` false and skip rename/delete/import/export menu items.
- Track context menu "Add to Playlist…" in `useLibraryTrackList` calls `addTracksToPlaylist` with file paths; for Spotify tracks this should be disabled or hidden to avoid writing Spotify URIs into local M3U playlists.
- Drag/drop into playlists should be disabled for Spotify tracks (no local file paths).

## Suggested Module Additions
- `src/providers/spotify/playlists.ts` for playlist list/track fetch:
  - `fetchSpotifyPlaylists(): Promise<ProviderPlaylist[]>` with pagination.
  - `fetchSpotifyPlaylistTracks(id): Promise<ProviderTrack[]>` with pagination.
- State layer for playlists/tracks:
  - Extend `src/providers/spotify/cache.ts` to store playlist list and tracks with `fetchedAt`.
  - Or add a new `createJSONManager` store (ex: `spotifyPlaylists$`) that keeps `playlists`, `tracksByPlaylistId`, `isLoading`, `error`.
- Consider invalidation on `logoutSpotify` and when active provider toggles away from Spotify.

## Spotify Playlist Data
- Add Spotify playlist fetching (including pagination) and map responses into provider-friendly playlist/track shapes.
- Cache playlist metadata and track lists to avoid refetching when toggling views.
- Guard fetches behind Spotify auth and enabled provider state (`providerSettings$.activeProviderId === "spotify"` + token).

## Media Library Integration
- Merge Spotify playlists into the media library sidebar when Spotify is the active provider; show a placeholder when unauthenticated.
- Support selecting a Spotify playlist to show its tracks in the track list view (with provider-aware selection).
- Distinguish Spotify playlists as read-only (no local edit/drag operations).

## Queue/Playback Wiring
- Map Spotify playlist tracks into queue entries that play via Spotify playback APIs.
- Ensure track context menus and double-click queueing work for Spotify playlist tracks.
- Disable "Add to Playlist…" and drag/drop for Spotify tracks (local playlists expect file paths).

## Steps
- [ ] Implement Spotify playlist + playlist-track fetching with caching and auth guards.
- [ ] Wire Spotify playlists into `MediaLibrarySidebar` and selection state when Spotify is enabled.
- [ ] Render Spotify playlist tracks in `TrackList` with proper queue actions and read-only behavior.
- [ ] Add/adjust tests around playlist track list building and selection behavior.

Validation: Unable to run the app here; please verify Spotify playlists appear in the media library sidebar, selecting a playlist lists tracks, and queuing/double-clicking plays via Spotify.
