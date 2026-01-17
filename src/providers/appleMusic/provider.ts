import { computed } from "@legendapp/state";
import type { Provider, ProviderCapabilities, ProviderInitOptions, ProviderSession } from "@/providers/types";
import {
    appleMusicAuthState$,
    isAppleMusicAuthorized$,
    setAppleMusicDeveloperToken,
} from "./authState";
import { authorizeAppleMusic, ensureAppleMusicDeveloperToken, logoutAppleMusic } from "./auth";

const capabilities: ProviderCapabilities = {
    supportsSearch: true,
    supportsLibrary: true,
    supportsPlayback: true,
    requiresPremium: true,
    requiresWebView: false,
};

const session$ = computed<ProviderSession>(() => {
    const auth = appleMusicAuthState$.get();
    const isAuthenticated = isAppleMusicAuthorized$.get();
    return {
        isAuthenticated,
        userDisplayName: auth.user?.name ?? "Apple Music",
        userId: auth.user?.id,
        product: auth.user?.subscription ?? undefined,
        expiresAt: auth.userTokenExpiresAt,
        deviceId: null,
    };
});

let stateListener: ProviderInitOptions["onStateChange"] | undefined;
let authSubscription: (() => void) | null = null;

export const appleMusicProvider: Provider = {
    id: "appleMusic",
    name: "Apple Music",
    capabilities,
    async initialize(options?: ProviderInitOptions) {
        stateListener = options?.onStateChange;
        authSubscription?.();
        authSubscription = appleMusicAuthState$.onChange(() => {
            stateListener?.(session$.get());
        });
        stateListener?.(session$.get());
        try {
            await ensureAppleMusicDeveloperToken();
        } catch (error) {
            setAppleMusicDeveloperToken(null, null);
            console.error("Apple Music developer token fetch failed", error);
        }
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
        await authorizeAppleMusic();
        return { authorizeUrl: "", state: "apple-music" };
    },
    async completeLogin(_params: { code: string; state: string }) {},
    async logout() {
        await logoutAppleMusic();
        if (stateListener) {
            stateListener(session$.get());
        }
    },
    async refresh() {
        try {
            await ensureAppleMusicDeveloperToken();
        } catch (error) {
            console.error("Apple Music developer token refresh failed", error);
        }
        if (stateListener) {
            stateListener(session$.get());
        }
    },
};
