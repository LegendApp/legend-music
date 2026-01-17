## Plan
Remove Spotify-specific logic from shared code by routing through provider plugins. Initialize all plugins on app
start, fan out search/library sync, and use the active track's source to drive playback control. Add a local MP3
plugin that follows the same plugin interface and performs filesystem scan during initialization.

## Research Notes
- `src/providers/pluginRegistry.ts` currently registers provider/search/playback but not library or UI hooks.
- `src/providers/providerRegistry.ts` tracks active provider ID; playback is routed via `getPlaybackProviderForTrack`.
- Local library scanning lives in `src/systems/LocalMusicState.ts` and is triggered from `src/App.tsx`.
- Spotify playlists/search/playback are referenced outside providers (sidebar, settings, audio player).

## Provider Scope
- Active playback plugin is derived from the active track's `provider` (fallback to `canHandle`).
- Search and library sync run across all available plugins.
- Now playing and playback controls are routed to the active track's provider.
- Local MP3 plugin runs filesystem scan in `initialize()` for parity with remote plugins.

## ProviderPlugin Interface Draft
```ts
import type React from "react";
import type { Observable } from "@legendapp/state";
import type {
    PlaybackProvider,
    Provider,
    ProviderInitOptions,
    ProviderPlaylist,
    ProviderTrack,
} from "@/providers/types";
import type { ProviderSearchProvider } from "@/providers/search/types";
import type { LocalTrack } from "@/systems/LocalMusicState";

export type ProviderPluginInitContext = {
    reason: "app-start" | "manual" | "background";
    providerOptions?: ProviderInitOptions;
};

export type ProviderLibraryPlugin = {
    sync?: (options?: { reason?: ProviderPluginInitContext["reason"] }) => Promise<void>;
    listPlaylists?: (options?: { force?: boolean }) => Promise<ProviderPlaylist[]>;
    listPlaylistTracks?: (playlistId: string, options?: { force?: boolean }) => Promise<ProviderTrack[]>;
    playlists$?: Observable<ProviderPlaylist[]>;
    status$?: Observable<{ isLoading: boolean; error: string | null }>;
};

export type ProviderTrackMapper = {
    isUri?: (value: string) => boolean;
    toLocalTrack?: (track: ProviderTrack) => LocalTrack;
};

export type ProviderPlugin = {
    provider: Provider;
    initialize?: (context?: ProviderPluginInitContext) => Promise<void> | void;
    teardown?: () => void;

    search?: ProviderSearchProvider;
    playback?: PlaybackProvider;
    library?: ProviderLibraryPlugin;
    tracks?: ProviderTrackMapper;

    ui?: {
        bridge?: React.ComponentType | null;
        settings?: React.ComponentType | null;
    };
};
```

## Integration Design Considerations
- `ensureProvidersRegistered()` should register plugins and run `initialize()` for all plugins.
- Replace Spotify-specific UI data flows with `plugin.library` and `plugin.search` lookups.
- Replace direct Spotify playback wiring with active playback plugin resolution.
- Move local scan trigger into the local MP3 plugin's `initialize()` to align with plugin lifecycle.
- Keep Spotify/YTM web player bridges behind `plugin.ui.bridge` instead of hardcoded imports in `App.tsx`.

## Suggested Module Additions
- Update `src/providers/pluginRegistry.ts` to register new plugin fields and expose plugin lookup helpers.
- Update `src/providers/setupProviders.ts` to initialize plugins (fan-out).
- Add/normalize `src/providers/local/plugin.ts` (local MP3) to implement `initialize`, `search`, `playback`, `library`.
- Update UI to consume `ProviderPlugin` capabilities instead of provider-specific imports.

## UI/Interaction Notes
- Library sidebar should list playlists based on available library plugins.
- Playback UI should render provider-specific badges/icons via plugin metadata if desired.
- Settings should render provider-specific sections via `plugin.ui.settings` when present.

## Steps
- [x] Define the new `ProviderPlugin` interface and update the registry to support library, UI, and init hooks.
- [ ] Add plugin initialization fan-out and move local filesystem scan into the local MP3 plugin.
- [ ] Replace Spotify-specific search/library usage in shared UI with plugin-based lookups.
- [ ] Route now playing and playback controls through the active playback plugin derived from the active track.
- [ ] Update Spotify/YTM plugin exports to conform to the new interface (playlists, search, playback, UI).
- [ ] Add/adjust tests for plugin selection, fan-out search/library, and active playback routing.

Validation: Start app, verify local scan runs on init, search hits all plugins, Spotify playlists load via plugin
library, and playback controls operate on the active track's provider.
