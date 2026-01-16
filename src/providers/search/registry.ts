import type { ProviderId } from "@/providers/types";
import type { ProviderSearchProvider } from "./types";

const registry: Record<ProviderId, ProviderSearchProvider> = {};

export function registerSearchProvider(provider: ProviderSearchProvider): void {
    registry[provider.id] = provider;
}

export function getSearchProvider(providerId: ProviderId): ProviderSearchProvider | undefined {
    return registry[providerId];
}

export function getSearchProviders(): ProviderSearchProvider[] {
    return Object.values(registry);
}
