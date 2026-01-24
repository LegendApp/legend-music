import { computed } from "@legendapp/state";
import type {
    StreamingProvider,
    StreamingProviderCapabilities,
    StreamingProviderInitOptions,
    StreamingProviderSession,
} from "@/providers/types";
import {
    clearSpotifyAuth,
    isSpotifyAuthenticated$,
    setSpotifyTokens,
    setSpotifyUser,
    spotifyAuthState$,
} from "./authState";
import { clearSpotifyPlaylistsCache } from "./playlistsState";
import {
    completeSpotifyLogin,
    ensureSpotifyAccessToken,
    refreshAccessToken,
    startSpotifyLogin,
} from "./auth";
import { SPOTIFY_DEVICE_NAME } from "./constants";

const capabilities: StreamingProviderCapabilities = {
    supportsSearch: true,
    supportsLibrary: true,
    supportsPlayback: true,
    requiresPremium: true,
    requiresWebView: true,
};

const session$ = computed<StreamingProviderSession>(() => {
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

let stateListener: StreamingProviderInitOptions["onStateChange"] | undefined;
let authSubscription: (() => void) | null = null;

export const spotifyProvider: StreamingProvider = {
    id: "spotify",
    name: "Spotify",
    capabilities,
    async initialize(options?: StreamingProviderInitOptions) {
        stateListener = options?.onStateChange;
        authSubscription?.();
        authSubscription = spotifyAuthState$.onChange(() => {
            stateListener?.(session$.get());
        });
        stateListener?.(session$.get());
    },
    teardown() {
        stateListener = undefined;
        authSubscription?.();
        authSubscription = null;
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
        clearSpotifyPlaylistsCache();
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
