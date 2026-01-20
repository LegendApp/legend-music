import { computed, observable } from "@legendapp/state";
import type { ProviderId } from "@/providers/types";
import type { ProviderSearchProvider } from "./types";

const registry: Record<ProviderId, ProviderSearchProvider> = {};
const registryVersion$ = observable(0);

export function registerSearchProvider(provider: ProviderSearchProvider): void {
    registry[provider.id] = provider;
    registryVersion$.set((value) => value + 1);
}

export function getSearchProvider(providerId: ProviderId): ProviderSearchProvider | undefined {
    return registry[providerId];
}

export function getSearchProviders(): ProviderSearchProvider[] {
    return Object.values(registry);
}

export const enabledSearchProviderIds$ = computed(() => {
    registryVersion$.get();
    return Object.values(registry)
        .filter((provider) => (provider.isEnabled$ ? provider.isEnabled$.get() : true))
        .map((provider) => provider.id);
});

export const searchProviders$ = computed(() => {
    registryVersion$.get();
    return Object.values(registry);
});
