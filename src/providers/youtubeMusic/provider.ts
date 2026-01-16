import { computed } from "@legendapp/state";
import type { Provider, ProviderCapabilities, ProviderInitOptions, ProviderSession } from "@/providers/types";
import { stateSaved$ } from "@/systems/State";

const capabilities: ProviderCapabilities = {
    supportsSearch: true,
    supportsLibrary: false,
    supportsPlayback: true,
    requiresPremium: false,
    requiresWebView: true,
};

const session$ = computed<ProviderSession>(() => {
    const apiKey = stateSaved$.youtubeMusicApiKey.get().trim();
    return {
        isAuthenticated: apiKey.length > 0,
        userDisplayName: "YouTube Music",
    };
});

let stateListener: ProviderInitOptions["onStateChange"] | undefined;
let sessionUnsubscribe: (() => void) | null = null;

export const youtubeMusicProvider: Provider = {
    id: "youtubeMusic",
    name: "YouTube Music",
    capabilities,
    async initialize(options?: ProviderInitOptions) {
        stateListener = options?.onStateChange;
        sessionUnsubscribe?.();
        sessionUnsubscribe = stateSaved$.youtubeMusicApiKey.onChange(() => {
            stateListener?.(session$.get());
        });
        stateListener?.(session$.get());
    },
    teardown() {
        stateListener = undefined;
        sessionUnsubscribe?.();
        sessionUnsubscribe = null;
    },
    getSession() {
        return session$.get();
    },
    async login() {
        return { authorizeUrl: "", state: "" };
    },
    async completeLogin() {
        return;
    },
    async logout() {
        return;
    },
    async refresh() {
        return;
    },
};
