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
import type { ContextMenuItem } from "@/native-modules/ContextMenu";

export type ProviderPluginInitContext = {
    reason: "app-start" | "manual" | "background";
    providerOptions?: ProviderInitOptions;
};

export type ProviderLibraryPlugin = {
    sync?: (options?: { reason?: ProviderPluginInitContext["reason"] }) => Promise<void>;
    listPlaylists?: (options?: { force?: boolean }) => Promise<ProviderPlaylist[]>;
    listPlaylistTracks?: (playlistId: string, options?: { force?: boolean }) => Promise<ProviderTrack[]>;
    playlists$?: Observable<ProviderPlaylist[]>;
    status$?: Observable<ProviderLibraryStatus>;
};

export type ProviderLibraryStatus = {
    isLoading: boolean;
    error: string | null;
    tracksLoading?: Record<string, boolean>;
    tracksError?: Record<string, string | null>;
};

export type ProviderTrackMapper = {
    isUri?: (value: string) => boolean;
    toLocalTrack?: (track: ProviderTrack, options?: { index?: number }) => LocalTrack;
};

export type ProviderTrackContextMenu = {
    getItems: (track: LocalTrack) => ContextMenuItem[];
    onSelect?: (selection: string, track: LocalTrack) => Promise<boolean> | boolean;
};

export type ProviderPlugin = {
    provider: Provider;
    initialize?: (context?: ProviderPluginInitContext) => Promise<void> | void;
    teardown?: () => void;
    search?: ProviderSearchProvider;
    playback?: PlaybackProvider;
    library?: ProviderLibraryPlugin;
    tracks?: ProviderTrackMapper;
    trackContextMenu?: ProviderTrackContextMenu;
    ui?: {
        bridge?: ComponentType | null;
        settings?: ComponentType | null;
        badge?: ComponentType<{ size?: number }>;
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

export function getProviderPluginForUri(value: string): ProviderPlugin | undefined {
    if (!value) {
        return undefined;
    }

    return getProviderPlugins().find((plugin) => plugin.tracks?.isUri?.(value));
}

export function getProviderIdForUri(value: string): ProviderId | null {
    return getProviderPluginForUri(value)?.provider.id ?? null;
}
