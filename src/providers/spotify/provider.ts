import { computed } from "@legendapp/state";
import type { Provider, ProviderCapabilities, ProviderInitOptions, ProviderSession } from "@/providers/types";
import {
    clearSpotifyAuth,
    isSpotifyAuthenticated$,
    setSpotifyTokens,
    setSpotifyUser,
    spotifyAuthState$,
} from "./authState";
import {
    completeSpotifyLogin,
    ensureSpotifyAccessToken,
    refreshAccessToken,
    startSpotifyLogin,
} from "./auth";
import { SPOTIFY_DEVICE_NAME } from "./constants";

const capabilities: ProviderCapabilities = {
    supportsSearch: true,
    supportsLibrary: true,
    supportsPlayback: true,
    requiresPremium: true,
    requiresWebView: true,
};

const session$ = computed<ProviderSession>(() => {
    const auth = spotifyAuthState$.get();
    const isAuthenticated = isSpotifyAuthenticated$.get();
    return {
        isAuthenticated,
        userDisplayName: auth.user?.displayName,
        userEmail: auth.user?.email,
        userId: auth.user?.id,
        product: auth.user?.product,
        scopes: auth.scope,
        expiresAt: auth.expiresAt,
        deviceId: null,
    };
});

let stateListener: ProviderInitOptions["onStateChange"] | undefined;

export const spotifyProvider: Provider = {
    id: "spotify",
    name: "Spotify",
    capabilities,
    async initialize(options?: ProviderInitOptions) {
        stateListener = options?.onStateChange;
        if (stateListener) {
            stateListener(session$.get());
        }
    },
    teardown() {
        stateListener = undefined;
    },
    getSession() {
        return session$.get();
    },
    async login() {
        const { authorizeUrl, state } = await startSpotifyLogin();
        return { authorizeUrl, state };
    },
    async completeLogin(params: { code: string; state: string }) {
        await completeSpotifyLogin(params);
        if (stateListener) {
            stateListener(session$.get());
        }
    },
    async logout() {
        clearSpotifyAuth();
        setSpotifyTokens({
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            scope: [],
        });
        setSpotifyUser(null);
        if (stateListener) {
            stateListener(session$.get());
        }
    },
    async refresh() {
        const current = spotifyAuthState$.get();
        if (!current.refreshToken) {
            return;
        }
        const tokens = await refreshAccessToken();
        setSpotifyTokens(tokens);
        if (stateListener) {
            stateListener(session$.get());
        }
    },
};
