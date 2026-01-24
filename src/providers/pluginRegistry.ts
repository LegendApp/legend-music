import type { Observable } from "@legendapp/state";
import type { ComponentType } from "react";
import { registerStreamingProvider } from "@/providers/streamingProviderRegistry";
import { registerSearchProvider } from "@/providers/search/registry";
import type { StreamingProviderSearchProvider } from "@/providers/search/types";
import {
    registerPlaybackProvider,
    type PlaybackProvider,
    type StreamingProvider,
    type StreamingProviderId,
    type StreamingProviderInitOptions,
    type StreamingProviderPlaylist,
    type StreamingProviderTrack,
} from "@/providers/types";
import type { LocalTrack } from "@/systems/LocalMusicState";
import type { ContextMenuItem } from "@/native-modules/ContextMenu";

export type StreamingProviderPluginInitContext = {
    reason: "app-start" | "manual" | "background";
    providerOptions?: StreamingProviderInitOptions;
};

export type StreamingProviderLibraryPlugin = {
    sync?: (options?: { reason?: StreamingProviderPluginInitContext["reason"] }) => Promise<void>;
    listPlaylists?: (options?: { force?: boolean }) => Promise<StreamingProviderPlaylist[]>;
    listPlaylistTracks?: (playlistId: string, options?: { force?: boolean }) => Promise<StreamingProviderTrack[]>;
    playlists$?: Observable<StreamingProviderPlaylist[]>;
    status$?: Observable<StreamingProviderLibraryStatus>;
};

export type StreamingProviderLibraryStatus = {
    isLoading: boolean;
    error: string | null;
    tracksLoading?: Record<string, boolean>;
    tracksError?: Record<string, string | null>;
};

export type StreamingProviderTrackMapper = {
    isUri?: (value: string) => boolean;
    toLocalTrack?: (track: StreamingProviderTrack, options?: { index?: number }) => LocalTrack;
};

export type StreamingProviderTrackContextMenu = {
    getItems: (track: LocalTrack) => ContextMenuItem[];
    onSelect?: (selection: string, track: LocalTrack) => Promise<boolean> | boolean;
};

export type StreamingProviderPlugin = {
    provider: StreamingProvider;
    initialize?: (context?: StreamingProviderPluginInitContext) => Promise<void> | void;
    teardown?: () => void;
    search?: StreamingProviderSearchProvider;
    playback?: PlaybackProvider;
    library?: StreamingProviderLibraryPlugin;
    tracks?: StreamingProviderTrackMapper;
    trackContextMenu?: StreamingProviderTrackContextMenu;
    ui?: {
        bridge?: ComponentType | null;
        settings?: ComponentType | null;
        badge?: ComponentType<{ size?: number }>;
    };
};

const registry: Record<StreamingProviderId, StreamingProviderPlugin> = {};

export function registerStreamingProviderPlugin(plugin: StreamingProviderPlugin): void {
    registerStreamingProvider(plugin.provider);
    if (plugin.search) {
        registerSearchProvider(plugin.search);
    }
    if (plugin.playback) {
        registerPlaybackProvider(plugin.playback);
    }
    registry[plugin.provider.id] = plugin;
}

export function getStreamingProviderPlugin(providerId: StreamingProviderId): StreamingProviderPlugin | undefined {
    return registry[providerId];
}

export function getStreamingProviderPlugins(): StreamingProviderPlugin[] {
    return Object.values(registry);
}

export function getStreamingProviderPluginForUri(value: string): StreamingProviderPlugin | undefined {
    if (!value) {
        return undefined;
    }

    return getStreamingProviderPlugins().find((plugin) => plugin.tracks?.isUri?.(value));
}

export function getStreamingProviderIdForUri(value: string): StreamingProviderId | null {
    return getStreamingProviderPluginForUri(value)?.provider.id ?? null;
}
