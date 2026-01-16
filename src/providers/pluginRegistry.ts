import { registerProvider } from "@/providers/providerRegistry";
import { registerSearchProvider } from "@/providers/search/registry";
import { registerPlaybackProvider, type PlaybackProvider, type Provider, type ProviderId } from "@/providers/types";
import type { ProviderSearchProvider } from "@/providers/search/types";

export type ProviderPlugin = {
    provider: Provider;
    searchProvider?: ProviderSearchProvider;
    playbackProvider?: PlaybackProvider;
};

const registry: Record<ProviderId, ProviderPlugin> = {};

export function registerProviderPlugin(plugin: ProviderPlugin): void {
    registerProvider(plugin.provider);
    if (plugin.searchProvider) {
        registerSearchProvider(plugin.searchProvider);
    }
    if (plugin.playbackProvider) {
        registerPlaybackProvider(plugin.playbackProvider);
    }
    registry[plugin.provider.id] = plugin;
}

export function getProviderPlugin(providerId: ProviderId): ProviderPlugin | undefined {
    return registry[providerId];
}

export function getProviderPlugins(): ProviderPlugin[] {
    return Object.values(registry);
}
