import { computed } from "@legendapp/state";
import { createJSONManager } from "@/utils/JSONManager";
import type { AppleMusicAuthState, AppleMusicTokens, AppleMusicUserProfile } from "./types";

const INITIAL_AUTH_STATE: AppleMusicAuthState = {
    developerToken: null,
    developerTokenExpiresAt: null,
    userToken: null,
    userTokenExpiresAt: null,
    storefront: null,
    user: null,
};

export const appleMusicAuthState$ = createJSONManager<AppleMusicAuthState>({
    filename: "apple-music-auth",
    initialValue: INITIAL_AUTH_STATE,
});

export const hasAppleMusicDeveloperToken$ = computed(() => {
    const state = appleMusicAuthState$.get();
    return Boolean(
        state.developerToken &&
            (!state.developerTokenExpiresAt || state.developerTokenExpiresAt > Date.now() + 30_000),
    );
});

export const isAppleMusicAuthorized$ = computed(() => {
    const state = appleMusicAuthState$.get();
    return Boolean(
        state.userToken && (!state.userTokenExpiresAt || state.userTokenExpiresAt > Date.now() + 30_000),
    );
});

export const isAppleMusicAuthenticated$ = computed(() => {
    const state = appleMusicAuthState$.get();
    return Boolean(
        state.userToken &&
            state.developerToken &&
            (!state.userTokenExpiresAt || state.userTokenExpiresAt > Date.now() + 30_000),
    );
});

export function setAppleMusicDeveloperToken(token: string | null, expiresAt: number | null): void {
    appleMusicAuthState$.developerToken.set(token);
    appleMusicAuthState$.developerTokenExpiresAt.set(expiresAt);
}

export function setAppleMusicUserToken(token: string | null, expiresAt: number | null): void {
    appleMusicAuthState$.userToken.set(token);
    appleMusicAuthState$.userTokenExpiresAt.set(expiresAt);
}

export function setAppleMusicStorefront(storefront: string | null): void {
    appleMusicAuthState$.storefront.set(storefront);
}

export function setAppleMusicUser(user: AppleMusicUserProfile | null): void {
    appleMusicAuthState$.user.set(user);
}

export function clearAppleMusicAuth(): void {
    appleMusicAuthState$.set(INITIAL_AUTH_STATE);
}
