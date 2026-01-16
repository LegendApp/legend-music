import { computed } from "@legendapp/state";
import Config from "react-native-config";
import type { Provider, ProviderCapabilities, ProviderInitOptions, ProviderSession } from "@/providers/types";

const capabilities: ProviderCapabilities = {
    supportsSearch: true,
    supportsLibrary: false,
    supportsPlayback: true,
    requiresPremium: false,
    requiresWebView: true,
};

const session$ = computed<ProviderSession>(() => {
    const apiKey = (Config.YOUTUBE_CLIENT_ID ?? "").trim();
    return {
        isAuthenticated: apiKey.length > 0,
        userDisplayName: "YouTube Music",
    };
});

let stateListener: ProviderInitOptions["onStateChange"] | undefined;

export const youtubeMusicProvider: Provider = {
    id: "youtubeMusic",
    name: "YouTube Music",
    capabilities,
    async initialize(options?: ProviderInitOptions) {
        stateListener = options?.onStateChange;
        stateListener?.(session$.get());
    },
    teardown() {
        stateListener = undefined;
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
