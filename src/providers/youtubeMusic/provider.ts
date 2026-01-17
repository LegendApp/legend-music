import { computed } from "@legendapp/state";
import type { Provider, ProviderCapabilities, ProviderInitOptions, ProviderSession } from "@/providers/types";
import {
    clearYoutubeMusicAuth,
    isYoutubeMusicAuthenticated$,
    setYoutubeMusicTokens,
    youtubeAuthState$,
} from "./authState";
import {
    completeYoutubeMusicLogin,
    refreshYoutubeMusicAccessToken,
    startYoutubeMusicLogin,
} from "./auth";

const capabilities: ProviderCapabilities = {
    supportsSearch: true,
    supportsLibrary: false,
    supportsPlayback: true,
    requiresPremium: false,
    requiresWebView: true,
};

const session$ = computed<ProviderSession>(() => {
    const auth = youtubeAuthState$.get();
    const isAuthenticated = isYoutubeMusicAuthenticated$.get();
    return {
        isAuthenticated,
        userDisplayName: auth.user?.displayName ?? "YouTube Music",
        userEmail: auth.user?.email,
        userId: auth.user?.id,
        scopes: auth.scope,
        expiresAt: auth.expiresAt,
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
        const { authorizeUrl, state } = await startYoutubeMusicLogin();
        return { authorizeUrl, state };
    },
    async completeLogin(params: { code: string; state: string }) {
        await completeYoutubeMusicLogin(params);
        if (stateListener) {
            stateListener(session$.get());
        }
    },
    async logout() {
        clearYoutubeMusicAuth();
        if (stateListener) {
            stateListener(session$.get());
        }
    },
    async refresh() {
        const current = youtubeAuthState$.get();
        if (!current.refreshToken) {
            return;
        }
        const tokens = await refreshYoutubeMusicAccessToken();
        setYoutubeMusicTokens(tokens);
        if (stateListener) {
            stateListener(session$.get());
        }
    },
};
