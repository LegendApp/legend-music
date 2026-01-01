## Plan
Extract Spotify-specific playback behavior out of `src/components/LocalAudioPlayer.tsx` into provider modules, and make the main player component provider-agnostic.

## Research Notes
- `src/components/LocalAudioPlayer.tsx` mixes queue/state orchestration with local-file playback and Spotify Web Playback SDK behaviors.
- Spotify Web Playback SDK state arrives via `src/providers/spotify/SpotifyWebPlayerHost.tsx` and is stored in `src/providers/spotify/webPlayerState.ts`.
- `LocalTrack` in `src/systems/LocalMusicState.ts` already carries `provider`, `uri`, `durationMs`, and `thumbnail`, which can support multi-provider playback.
- Queue persistence uses `src/utils/m3uManager.ts`, including thumbnail handling and Spotify URI detection.

## Current Playback Flow
- `LocalAudioPlayer.tsx` owns `localPlayerState$`, queue controls, persistence, and all playback operations.
- Spotify handling is interleaved:
  - Provider detection via `track.provider === "spotify"`.
  - Web Playback commands (activate, transfer, play, pause, seek, volume).
  - Web SDK state handling for position/duration/paused updates and artwork.
- Local handling includes file existence, native AudioPlayer calls, and local thumbnail hydration.

## Integration Design Considerations
- Keep queue/persistence/state orchestration centralized to avoid diverging behavior between providers.
- Use a small provider adapter interface with:
  - `load/play/pause/seek/setVolume` (required)
  - `getDurationSeconds` and `hydrateTrackMetadata` (optional)
  - `onStateChange` for provider-driven updates (Spotify Web SDK).
- Preserve existing `LocalTrack` shape and `queue.m3u` format.
- Avoid changing provider semantics for `LocalTrack` (local provider is still default).

## Suggested Module Additions
- `src/providers/types.ts`
  - Add `PlaybackProvider` interface and helper to resolve provider by track.
- `src/providers/local/playbackProvider.ts`
  - Wrap native `AudioPlayer` and local file behavior.
  - Handle file existence checks, now-playing updates, and local thumbnail hydration.
- `src/providers/spotify/playbackProvider.ts`
  - Wrap Spotify Web Playback SDK operations.
  - Expose state subscription to feed position/duration/paused/artwork updates.
- `src/providers/spotify/playerState.ts`
  - Parse Spotify state payload into a normalized shape (id, position, duration, artwork).

## Queue/State Wiring
- `src/components/AudioPlayer.tsx` (renamed from `LocalAudioPlayer.tsx`) owns:
  - `localPlayerState$`, queue controls, persistence, and UI-facing APIs.
  - Delegation to provider adapter based on `track.provider`.
- Provider state updates should map back into `localPlayerState$` and queue entries (artwork, duration, isPlaying).

## Steps
- [ ] Define `PlaybackProvider` interface and provider registry/lookup helper in `src/providers/types.ts`.
- [ ] Extract local-file playback into `src/providers/local/playbackProvider.ts` and adjust `LocalAudioPlayer` to use it.
- [ ] Extract Spotify playback + state handling into `src/providers/spotify/playbackProvider.ts` and `src/providers/spotify/playerState.ts`.
- [ ] Rename `src/components/LocalAudioPlayer.tsx` to `src/components/AudioPlayer.tsx` and make it provider-agnostic.
- [ ] Update imports/usages (UI and tests) to use the new `AudioPlayer` module.
- [ ] Ensure queue persistence and Spotify URI handling remain unchanged in `src/utils/m3uManager.ts`.

Validation: Unable to run here; please verify local playback still works, Spotify playback controls respond, album art updates on Spotify tracks, and queue persistence loads/stores Spotify items correctly.
