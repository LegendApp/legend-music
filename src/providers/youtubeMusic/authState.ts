import { computed } from "@legendapp/state";
import { createJSONManager } from "@/utils/JSONManager";
import type { YoutubeAuthState, YoutubeTokens, YoutubeUserProfile } from "./authTypes";

const INITIAL_AUTH_STATE: YoutubeAuthState = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    scope: [],
    user: null,
    codeVerifier: null,
    codeState: null,
};

export const youtubeAuthState$ = createJSONManager<YoutubeAuthState>({
    filename: "youtube-auth",
    initialValue: INITIAL_AUTH_STATE,
});

export const isYoutubeMusicAuthenticated$ = computed(() => {
    const state = youtubeAuthState$.get();
    return Boolean(state.accessToken && state.expiresAt && state.expiresAt > Date.now());
});

export function setYoutubeMusicTokens(tokens: YoutubeTokens): void {
    youtubeAuthState$.accessToken.set(tokens.accessToken);
    youtubeAuthState$.refreshToken.set(tokens.refreshToken);
    youtubeAuthState$.expiresAt.set(tokens.expiresAt);
    youtubeAuthState$.scope.set(tokens.scope);
}

export function setYoutubeMusicUser(user: YoutubeUserProfile | null): void {
    youtubeAuthState$.user.set(user);
}

export function setYoutubeMusicPKCEState(verifier: string | null, state: string | null): void {
    youtubeAuthState$.codeVerifier.set(verifier);
    youtubeAuthState$.codeState.set(state);
}

export function clearYoutubeMusicAuth(): void {
    youtubeAuthState$.set(INITIAL_AUTH_STATE);
}
