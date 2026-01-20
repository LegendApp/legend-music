import { computed, observable } from "@legendapp/state";
import type { SuggestionProvider, SuggestionProviderId } from "@/systems/suggestions/types";
import { claudeSuggestionProvider } from "@/systems/suggestions/providers/claude";
import { codexSuggestionProvider } from "@/systems/suggestions/providers/codex";
import { spotifySuggestionProvider } from "@/systems/suggestions/providers/spotify";

const registry: Record<SuggestionProviderId, SuggestionProvider> = {};
const registryVersion$ = observable(0);
let providersRegistered = false;

export function registerSuggestionProvider(provider: SuggestionProvider): void {
    registry[provider.id] = provider;
    registryVersion$.set((value) => value + 1);
}

export function ensureSuggestionProvidersRegistered(): void {
    if (providersRegistered) {
        return;
    }

    providersRegistered = true;
    registerSuggestionProvider(claudeSuggestionProvider);
    registerSuggestionProvider(codexSuggestionProvider);
    registerSuggestionProvider(spotifySuggestionProvider);
}

export function getSuggestionProvider(providerId: SuggestionProviderId): SuggestionProvider | undefined {
    registryVersion$.get();
    return registry[providerId];
}

export function getSuggestionProviders(): SuggestionProvider[] {
    registryVersion$.get();
    return Object.values(registry);
}

export const suggestionProviders$ = computed(() => {
    ensureSuggestionProvidersRegistered();
    registryVersion$.get();
    return Object.values(registry);
});
