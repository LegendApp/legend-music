import { computed, observable } from "@legendapp/state";
import { createJSONManager } from "@/utils/JSONManager";
import type { Provider, ProviderId, ProviderSession } from "./types";

type ProviderSettings = {
    activeProviderId: ProviderId;
    lastProviderId?: ProviderId;
};

const providerSettings$ = createJSONManager<ProviderSettings>({
    filename: "provider-settings",
    initialValue: {
        activeProviderId: "local",
        lastProviderId: "local",
    },
});

const registry = observable<Record<ProviderId, Provider>>({});

export const activeProviderId$ = computed(() => providerSettings$.activeProviderId.get());
export { providerSettings$ };

export function registerProvider(provider: Provider): void {
    const current = registry.get();
    registry.set({
        ...current,
        [provider.id]: provider,
    });
}

export function getProvider(providerId: ProviderId): Provider | undefined {
    return registry[providerId].get() as unknown as Provider | undefined;
}

export function getActiveProvider(): Provider | undefined {
    const id = activeProviderId$.get();
    return getProvider(id);
}

export function setActiveProvider(providerId: ProviderId): void {
    providerSettings$.activeProviderId.set(providerId);
    providerSettings$.lastProviderId.set(providerId);
}

export function getRegisteredProviders(): Provider[] {
    return Object.values(registry.peek()) as Provider[];
}

export function getProviderSession(providerId: ProviderId): ProviderSession | null {
    const provider = getProvider(providerId);
    return provider ? provider.getSession() : null;
}

export function isProviderEnabled(providerId: ProviderId): boolean {
    return activeProviderId$.get() === providerId;
}
