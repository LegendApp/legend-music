import { computed, observable } from "@legendapp/state";
import { isStreamingProviderEnabled } from "@/providers/streamingProviderRegistry";
import { LOCAL_LIBRARY_PROVIDER_ID } from "@/providers/localLibrary/constants";
import type { StreamingProviderId } from "@/providers/types";
import type { StreamingProviderSearchProvider } from "./types";

const registry: Record<StreamingProviderId, StreamingProviderSearchProvider> = {};
const registryVersion$ = observable(0);

export function registerSearchProvider(provider: StreamingProviderSearchProvider): void {
    registry[provider.id] = provider;
    registryVersion$.set((value) => value + 1);
}

export function getSearchProvider(providerId: StreamingProviderId): StreamingProviderSearchProvider | undefined {
    return registry[providerId];
}

export function getSearchProviders(): StreamingProviderSearchProvider[] {
    return Object.values(registry);
}

export const enabledSearchProviderIds$ = computed(() => {
    registryVersion$.get();
    return Object.values(registry)
        .filter((provider) => {
            if (
                provider.id !== "local" &&
                provider.id !== LOCAL_LIBRARY_PROVIDER_ID &&
                !isStreamingProviderEnabled(provider.id)
            ) {
                return false;
            }
            return provider.isEnabled$ ? provider.isEnabled$.get() : true;
        })
        .map((provider) => provider.id);
});

export const searchProviders$ = computed(() => {
    registryVersion$.get();
    return Object.values(registry);
});
