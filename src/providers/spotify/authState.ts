import { computed } from "@legendapp/state";
import { createJSONManager } from "@/utils/JSONManager";
import type { SpotifyAuthState, SpotifyTokens, SpotifyUserProfile } from "./types";

const INITIAL_AUTH_STATE: SpotifyAuthState = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    scope: [],
    user: null,
    codeVerifier: null,
    codeState: null,
};

export const spotifyAuthState$ = createJSONManager<SpotifyAuthState>({
    filename: "spotify-auth",
    initialValue: INITIAL_AUTH_STATE,
});

export const isSpotifyAuthenticated$ = computed(() => {
    const state = spotifyAuthState$.get();
    return Boolean(state.accessToken && state.refreshToken && state.expiresAt && state.expiresAt > Date.now());
});

export function setSpotifyTokens(tokens: SpotifyTokens): void {
    spotifyAuthState$.accessToken.set(tokens.accessToken);
    spotifyAuthState$.refreshToken.set(tokens.refreshToken);
    spotifyAuthState$.expiresAt.set(tokens.expiresAt);
    spotifyAuthState$.scope.set(tokens.scope);
}

export function setSpotifyUser(user: SpotifyUserProfile | null): void {
    spotifyAuthState$.user.set(user);
}

export function setPKCEState(verifier: string | null, state: string | null): void {
    spotifyAuthState$.codeVerifier.set(verifier);
    spotifyAuthState$.codeState.set(state);
}

export function clearSpotifyAuth(): void {
    spotifyAuthState$.set(INITIAL_AUTH_STATE);
}
