import { computed } from "@legendapp/state";
import { settings$ } from "@/systems/Settings";
import {
    ensureSuggestionProvidersRegistered,
    getSuggestionProvider,
    suggestionProviders$,
} from "@/systems/suggestions/registry";
import type {
    SuggestionProvider,
    SuggestionProviderId,
    SuggestionRequest,
    SuggestionResult,
} from "@/systems/suggestions/types";

const DEFAULT_PROVIDER_ID: SuggestionProviderId = "claude";

const coerceProviderId = (value?: string | null): SuggestionProviderId => {
    if (value === "claude" || value === "codex" || value === "spotify") {
        return value;
    }
    return DEFAULT_PROVIDER_ID;
};

export const selectedSuggestionProviderId$ = computed(() => {
    ensureSuggestionProvidersRegistered();
    return coerceProviderId(settings$.ai.suggestionProviderId.get());
});

export const selectedSuggestionProvider$ = computed(() => {
    ensureSuggestionProvidersRegistered();
    const providerId = selectedSuggestionProviderId$.get();
    return getSuggestionProvider(providerId) ?? null;
});

export const isSelectedSuggestionProviderAvailable$ = computed(() => {
    ensureSuggestionProvidersRegistered();
    const providerId = selectedSuggestionProviderId$.get();
    const provider = getSuggestionProvider(providerId);
    return provider?.isAvailable() ?? false;
});

export const suggestionProviderAvailability$ = computed(() => {
    ensureSuggestionProvidersRegistered();
    const providers = suggestionProviders$.get();
    const availability: Record<SuggestionProviderId, boolean> = {
        claude: false,
        codex: false,
        spotify: false,
    };

    for (const provider of providers) {
        availability[provider.id] = provider.isAvailable();
    }

    return availability;
});

export function getSuggestionProviderById(providerId: SuggestionProviderId): SuggestionProvider {
    ensureSuggestionProvidersRegistered();
    const provider = getSuggestionProvider(providerId);
    if (!provider) {
        throw new Error(`Suggestion provider not found: ${providerId}`);
    }
    return provider;
}

export async function fetchSuggestions(request: SuggestionRequest): Promise<SuggestionResult> {
    ensureSuggestionProvidersRegistered();

    const aiSettings = settings$.ai.get();
    if (!aiSettings.enabled) {
        throw new Error("Suggestion features are disabled in settings.");
    }
    if (request.mode === "queue-extension" && request.source === "auto" && !aiSettings.autoExtendQueue) {
        throw new Error("Queue extension is disabled in settings.");
    }

    const providerId = request.providerIdOverride ?? selectedSuggestionProviderId$.get();
    const provider = getSuggestionProviderById(providerId);

    if (!provider.isAvailable()) {
        throw new Error(`${provider.name} is not available.`);
    }

    if (!provider.supportsModes.includes(request.mode)) {
        throw new Error(`${provider.name} does not support ${request.mode}.`);
    }

    return provider.suggest(request);
}

export { suggestionProviders$ };
