## Plan
Implement Spotify as the first streaming provider via a plugin architecture, including PKCE auth, hidden webview playback with the Web Playback SDK, provider-aware queue handling, and UI entry points for login and provider selection.

## Current Files & Concepts (No Prior Context Required)
- App shell and state: `src/App.tsx`, `src/systems/State.ts`, `src/settings/SettingsContainer.tsx`
- Queue, playback, and UI: `src/components/PlaybackArea.tsx`, `src/components/PlaybackControls.tsx`, `src/utils/queueActions.ts`, `src/native-modules/AudioPlayer.ts`
- Data/state foundations: `src/systems/LocalMusicState.ts`, `src/systems/LibraryState.ts`, `src/systems/State.ts`, `src/state/*`
- Webview and settings surfaces: `src/media-library/MediaLibraryWindow.tsx`, `src/components/MediaLibrary`, `src/components/PlaylistSelector`, `src/settings`
- Utilities: `src/utils/cacheDirectories.ts`, `src/utils/trackResolution.ts`, `src/utils/JSONManager.ts`

## Desired UX
- Spotify appears as a provider with a clear login/logout flow (PKCE), Premium requirement messaging, and visible active provider status.
- Users can search and browse Spotify content, add Spotify tracks/albums/playlists to the queue alongside local tracks, and see provider badges.
- Playback of Spotify items works through an embedded hidden webview (Web Playback SDK), with Now Playing/progress synchronized to existing UI.
- Local playback remains unchanged; Spotify failures degrade gracefully (skipped items, actionable errors).

## Steps
- [ ] Add Spotify auth module: PKCE flow, token exchange/refresh, secure refresh-token storage, and in-memory access token manager with expiry.
- [ ] Build Spotify provider contract implementation: provider registry, provider metadata/capabilities, provider-aware track/playlist models with `provider` + URI, and persistence hooks for provider selection and cached metadata.
- [ ] Implement hidden webview player host: HTML + SDK loader, postMessage bridge for commands/events, device readiness handshake, and activation gesture support.
- [ ] Wire queue/playback integration: route Spotify queue items to provider play/pause/seek/volume, handle device transfer, error states, and fallback/skip logic when provider unavailable.
- [ ] Add UI surfaces: settings/login/logout + Premium messaging, provider selector/badge, and provider-scoped search/library views with basic result rendering and queue actions.

### Step details

**Auth module (PKCE)**
- Generate verifier/challenge; open `https://accounts.spotify.com/authorize` with scopes: `streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-library-read playlist-read-private` (add write scopes later).
- Exchange code at `https://accounts.spotify.com/api/token` with client ID + code + redirect + verifier; persist refresh token in secure storage; keep access token + expiry in memory and auto-refresh on expiry/401.
- Include `market` selection (from `user.country` or device) for catalog calls; handle 429 `Retry-After` backoff; expose auth state (`isAuthenticated`, `userProfile`, `expiresAt`), `login`, `logout`, `refresh`.
- On logout, clear webview token cache and device ID; wipe refresh token; broadcast provider-unavailable state.

**Provider contract + data model**
- Provider registry keyed by `provider` string; capabilities flags (`supportsSearch`, `supportsLibrary`, `supportsPlayback`, `requiresPremium`, `requiresWebView`).
- Track model fields for Spotify: `provider: "spotify"`, `uri` (`spotify:track:...`), `id` (base62), `name`, `artists[]`, `album`, `durationMs`, `isExplicit`, `thumbnail`, `marketRestrictions`.
- Playlist model: `provider`, `uri`, `id`, `name`, `owner`, `trackCount`, `images[]`, `tracks` (lazy/paginated), `isEditable: false`.
- Persist active provider selection and lightweight caches (search results, playlists) via JSON manager with TTL; store auth state separately in secure storage.
- Events: playback state, auth errors, provider availability changes; expose `initialize`, `teardown`, `onForeground/background`.

**Hidden webview host**
- Local HTML that loads `https://sdk.scdn.co/spotify-player.js`, builds `Spotify.Player({ name, getOAuthToken })`, and posts messages to RN (`ready`, `not_ready`, `player_state_changed`, `initialization_error`, `authentication_error`, `account_error`, `playback_error`).
- Accept RN commands via `window.onmessage`: `setToken`, `activate`, `connect`, `play(uris/context_uri, position_ms)`, `pause`, `resume`, `seek`, `setVolume`.
- Handle user gesture: expose `activate` to call `player.activateElement()` after user presses play.
- On `ready`, send `device_id` to RN; on `not_ready`, request reconnect; keep volume state mirrored.

**Queue/playback integration**
- Queue items include provider + `uri`; when enqueuing Spotify items, avoid resolving to file paths—defer to provider `play`.
- On play request for Spotify item: ensure provider logged in and webview ready; if not, mark error and skip with toast.
- Perform device transfer via `/v1/me/player` with `device_id` before first play or after reconnect; then call `/v1/me/player/play` (context or uris) with `position_ms`.
- Map UI controls to provider methods: play/pause/seek/next/prev/volume. If provider unavailable mid-queue, skip Spotify items and continue locals.
- Sync Now Playing/progress from SDK `player_state_changed` events; propagate errors (403 Premium, 404 region, 429 rate limit) to UI.

**UI surfaces**
- Settings: login/logout button, Premium requirement note, signed-in user info, token status, and “reload Spotify player” debug control; provider selector (Local vs Spotify) stored in settings state.
- Library/Search: provider tabs or filter; Spotify tab shows search + user playlists/library via provider client. Queue buttons add items with provider badge.
- Playback UI: show provider badge near Now Playing; show loading/reconnect states when SDK not ready; prompt user gesture if activation required.
- Error UX: toasts/tooltips when Spotify item blocked (not logged in/Premium/offline/region); graceful skip for blocked items; re-auth prompt on 401/invalid token.

## Validation
- Manual: Login succeeds with PKCE; refresh token persists across relaunch; expired access token refreshes automatically.
- Manual: Hidden webview initializes SDK, reports `ready`, transfers playback, and plays/pauses/seeks Spotify tracks; errors from Premium/429/offline surface to UI.
- Manual: Mixed queue works—local tracks still play via AudioPlayer, Spotify items play via SDK or are skipped with a toast when unavailable.
- Manual: UI shows provider status, allows switching/Logout, and surfaces search/library results from Spotify with correct provider badges and queue actions.
