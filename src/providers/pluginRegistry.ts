import type { Observable } from "@legendapp/state";
import type { ComponentType } from "react";
import { registerProvider } from "@/providers/providerRegistry";
import { registerSearchProvider } from "@/providers/search/registry";
import type { ProviderSearchProvider } from "@/providers/search/types";
import {
    registerPlaybackProvider,
    type PlaybackProvider,
    type Provider,
    type ProviderId,
    type ProviderInitOptions,
    type ProviderPlaylist,
    type ProviderTrack,
} from "@/providers/types";
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
        bridge?: ComponentType | null;
        settings?: ComponentType | null;
    };
};

const registry: Record<ProviderId, ProviderPlugin> = {};

export function registerProviderPlugin(plugin: ProviderPlugin): void {
    registerProvider(plugin.provider);
    if (plugin.search) {
        registerSearchProvider(plugin.search);
    }
    if (plugin.playback) {
        registerPlaybackProvider(plugin.playback);
    }
    registry[plugin.provider.id] = plugin;
}

export function getProviderPlugin(providerId: ProviderId): ProviderPlugin | undefined {
    return registry[providerId];
}

export function getProviderPlugins(): ProviderPlugin[] {
    return Object.values(registry);
}
