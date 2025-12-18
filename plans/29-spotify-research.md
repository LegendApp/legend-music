## Plan
Design a provider plugin system focused on Spotify first (Apple Music later) with a hidden Web Playback SDK webview, mapping Spotify auth/catalog/playback to Legend Music’s library, queue, and playback flows.

## Current Files & Concepts (No Prior Context Required)
- App shell and persisted UI state: `src/App.tsx`, `src/systems/State.ts`, `src/settings/SettingsContainer.tsx`
- Local music ingestion and playlists: `src/systems/LocalMusicState.ts`, `src/systems/LocalPlaylists.ts`, `src/systems/LibraryState.ts`, `src/systems/LibraryCache.ts`
- Playback controls and player bridge: `src/components/PlaybackArea.tsx`, `src/components/PlaybackControls.tsx`, `src/native-modules/AudioPlayer.ts`, `src/utils/queueActions.ts`
- Media browsing and selection surfaces: `src/media-library/MediaLibraryWindow.tsx`, `src/components/MediaLibrary`, `src/components/PlaylistSelector`
- Settings and cache utilities: `src/systems/Settings.ts`, `src/utils/cacheDirectories.ts`, `src/utils/trackResolution.ts`

## Desired UX
- Spotify is a selectable provider with a clear login flow (PKCE), Premium requirement messaging, and visible active provider state.
- Users can search Spotify, browse playlists/library, and queue Spotify tracks/albums/playlists alongside local content without breaking existing queue behavior.
- Playback uses an embedded/hidden webview hosting the Spotify Web Playback SDK; player state drives Now Playing/progress consistently with local playback.
- Plugin architecture remains ready for additional providers (Apple Music next) without reworking core queue or playback flows.

## Steps
- [x] Document Spotify platform requirements: PKCE auth + scopes, Premium-only playback, Web Playback SDK lifecycle (device transfer, activation gestures), and key REST endpoints (search/catalog/library/playback).
- [x] Define the plugin contract and data model changes: provider capabilities, auth/session state, track/playlist identifiers (`spotify:track` URIs), queue resolution rules, and persistence points for tokens and cached metadata.
- [x] Sketch the Spotify plugin design: module layout (auth + token refresh, SDK loader in hidden webview, device transfer, playback/seek/volume), bridge messaging between RN and webview, and error/offline handling.
- [x] Plan UI/UX touchpoints for multi-provider support: settings for login/provider switching, library/search surfaces scoped per provider, queue mixing safeguards, and Premium/account error states.

### Step 1 findings — Spotify platform requirements
- Auth: Authorization Code with PKCE; client ID only (no secret) and redirect URI scheme we control. Scopes for playback + library: `streaming`, `user-read-email`, `user-read-private`, `user-read-playback-state`, `user-modify-playback-state`, `user-library-read`, `playlist-read-private` (add write scopes later if creating playlists). Access tokens ~1h; refresh tokens returned with PKCE and should be stored securely (Keychain). Rate limits via 429 + `Retry-After`.
- Premium requirement: Web Playback SDK and `/me/player/play` need a Premium account; free accounts fail with 403—surface this early in UI.
- Web Playback SDK lifecycle: load `https://sdk.scdn.co/spotify-player.js` in a real browser context (hidden webview). `Spotify.Player` needs `getOAuthToken` callback for fresh tokens. Must call `player.activateElement()` after a user gesture to start audio. On `ready`, capture `device_id`, then transfer playback via `PUT /v1/me/player` with `device_id`. Handle `not_ready` by retrying/refreshing tokens.
- Key REST endpoints:
  - OAuth: `https://accounts.spotify.com/authorize` (PKCE) → token exchange at `https://accounts.spotify.com/api/token` with code + verifier.
  - Playback control: `/v1/me/player` (transfer), `/v1/me/player/play|pause|seek|next|previous`, `/v1/me/player/devices`, `/v1/me/player/currently-playing`.
  - Catalog/search: `/v1/search` (tracks, albums, artists, playlists), `/v1/tracks/{id}`, `/v1/albums/{id}`, `/v1/playlists/{id}` + `/v1/playlists/{id}/tracks`.
  - User library: `/v1/me/tracks`, `/v1/me/albums`, `/v1/me/playlists`, `/v1/me/player/recently-played`.
- Playback constraints: No offline/DRM download via SDK; streams are HLS in-browser. Need `market` handling (device market or user country). Respect explicit filter flags and handle 404/403 for region-locked content. Token scopes gate endpoints; missing scopes should be treated as re-auth prompts.

### Step 2 findings — Plugin contract and data model
- Provider contract: Define interface with capabilities (`supportsSearch`, `supportsPlayback`, `supportsLibrary`, `requiresPremium`, `requiresWebView`), lifecycle hooks (`initialize`, `teardown`, `onAppForeground/background`), auth state (`isAuthenticated`, `login`, `logout`, `refresh`), playback hooks (`prepareDevice`, `play`, `pause`, `seek`, `setVolume`, `getState`), and data fetchers (`search`, `getPlaylist`, `getTracks`, `getUserPlaylists`, `getUserLibraryTracks`). Should emit events for player state and auth errors.
- Identity/data model: All remote items carry `provider: "spotify"` plus a stable `uri` (`spotify:track:...`, `spotify:album:...`, `spotify:playlist:...`), `id` (Spotify base62), and `sourceId` to avoid collision with local file IDs. Track shape includes `durationMs`, `name`, `artists`, `album`, `thumbnail`, `isExplicit`, `marketRestrictions`. Playlist shape includes owner, trackCount, images, and `uri`.
- Queue resolution rules: Keep queue entries provider-aware; defer loading to provider `play` using URIs. If the active provider cannot play (e.g., Premium missing), mark item error and skip without impacting local tracks. For mixed queues, only Spotify items need the SDK device; local files still go through `AudioPlayer`.
- Auth/session persistence: Store refresh token + expiry securely (Keychain/secure store). Store access token + device_id in volatile memory/cache. Persist provider selection and lightweight caches (search results, playlist metadata) in JSON with TTL to reduce API churn and keep queue references stable.
- Provider registry: Maintain map of providers keyed by `provider` string; allow swapping active provider without breaking local playback. Contract should surface `needsWebView` to manage hidden webview lifecycle only when Spotify is active/logged in.

### Step 3 findings — Spotify plugin design sketch
- Module layout:
  - `spotify/auth`: PKCE generator, browser/auth-session helper, token exchanger, refresh scheduler, secure storage for refresh token, in-memory access token with expiry.
  - `spotify/webview`: hidden `WebView` hosting HTML + Web Playback SDK. Loads SDK, initializes `Spotify.Player`, requests tokens via `postMessage`, sends events (`ready`, `not_ready`, `state`, `error`), and exposes commands (`activate`, `connect`, `play`, `pause`, `resume`, `seek`, `setVolume`).
  - `spotify/client`: typed fetcher for REST endpoints (search, playlists, tracks, me/player), handles 429 retry-after, `market` defaults, and merges auth header from token manager.
  - `spotify/provider`: implements plugin contract, owns webview lifecycle, registers event listeners to propagate playback state to app observables, and routes queue actions to SDK/Web API.
- Device/queue flow:
  1) On login success, refresh token stored; access token set in memory.
  2) Mount hidden webview; wait for `ready` + `device_id`.
  3) Transfer playback to the SDK device (`PUT /v1/me/player` with `device_id`), then issue `play` with URIs + `position_ms`.
  4) For play/pause/seek/volume, prefer SDK commands via webview; fall back to Web API if SDK reports not ready.
  5) Keep queue items lightweight; provider resolves URIs to playable state when requested, and errors surface back to queue manager.
- Error/offline handling:
  - Token expiry: catch 401s, refresh token, retry once. If refresh fails, emit auth error and pause provider usage.
  - Webview failures: if `not_ready` or lost device, attempt reconnect + device transfer; if repeated failures, mark provider unavailable and skip Spotify items.
  - Rate limits: respect `Retry-After`; queue retries with backoff for non-critical fetches, but surface playback-blocking errors immediately.
  - Offline: short-circuit playback requests with clear messaging; allow browsing cached metadata but mark playback blocked.

### Step 4 findings — UI/UX touchpoints
- Settings: Provider section with login/logout button, Premium requirement note, scope summary, and token status (signed in as email/username). Toggle for active provider (Local vs Spotify) while keeping local always available. Debug button to reload webview/player if stuck.
- Library/Search surfaces: Provider filter or tabs (Local, Spotify, All). When in Spotify tab, show search results, user playlists, and library items from Spotify APIs. Mixed “All” view can interleave with provider badges (e.g., Spotify pill) and disable unsupported actions (e.g., editing Spotify playlist).
- Queue behavior: Allow mixed queues; show provider badge per item. If Spotify unavailable (not logged in/Premium/offline), gray out Spotify items with tooltip and skip on play with toast explaining why. Keep local items unaffected.
- Playback UI: Display active provider near Now Playing (e.g., badge). On first Spotify playback, prompt user gesture to activate audio if needed. Show reconnect/loading states when webview/device is preparing; surface errors from SDK (403 Premium, 429 rate limit, device lost).
- Error/edge cases: If auth expires, prompt re-login and pause Spotify playback; keep queue but mark Spotify items as blocked until resolved. If country restriction hits, show explicit error on item. Provide “Retry transfer” action when device not ready.
## Validation
- Investigation notes cover Spotify auth, SDK constraints, required scopes/endpoints, and hidden webview viability.
- Plugin interface accommodates Spotify and future providers, with identified hook points in queue/library/playback.
- Proposed Spotify module and UI changes enable a vertical slice (login → search → queue → play via webview device) without regressing local playback.
