import { clearSpotifyAuth, setPKCEState, setSpotifyTokens, setSpotifyUser, spotifyAuthState$ } from "./authState";
import {
    SPOTIFY_AUTH_SCOPES,
    SPOTIFY_AUTH_URL,
    SPOTIFY_CLIENT_ID,
    SPOTIFY_REDIRECT_URI,
    SPOTIFY_TOKEN_URL,
} from "./constants";
import { createPKCEChallenge } from "./pkce";
import type { SpotifyAuthState, SpotifyTokens, SpotifyUserProfile } from "./types";

type TokenResponse = {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope?: string;
};

const FORM_HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded",
};

const encodeForm = (params: Record<string, string>): string =>
    Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");

export function buildAuthorizeUrl(state: string, codeChallenge: string): string {
    const scopes = SPOTIFY_AUTH_SCOPES.join(" ");
    const params = encodeForm({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: "code",
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_challenge_method: "S256",
        code_challenge: codeChallenge,
        scope: scopes,
        state,
    });
    return `${SPOTIFY_AUTH_URL}?${params}`;
}

async function fetchToken(params: Record<string, string>): Promise<TokenResponse> {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: "POST",
        headers: FORM_HEADERS,
        body: encodeForm({ client_id: SPOTIFY_CLIENT_ID, ...params }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Spotify token error ${response.status}: ${text}`);
    }

    return response.json() as Promise<TokenResponse>;
}

export async function startSpotifyLogin(): Promise<{ authorizeUrl: string; state: string; verifier: string }> {
    if (!SPOTIFY_CLIENT_ID) {
        throw new Error("Missing SPOTIFY_CLIENT_ID. Set env or config before login.");
    }

    const { verifier, challenge } = await createPKCEChallenge();
    const state = Math.random().toString(36).slice(2);
    setPKCEState(verifier, state);
    return {
        authorizeUrl: buildAuthorizeUrl(state, challenge),
        state,
        verifier,
    };
}

export async function exchangeCodeForToken(code: string, verifier: string): Promise<SpotifyTokens> {
    const token = await fetchToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: verifier,
    });

    const expiresAt = Date.now() + token.expires_in * 1000 - 60_000; // renew 60s early
    return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? spotifyAuthState$.refreshToken.peek(),
        expiresAt,
        scope: token.scope ? token.scope.split(" ") : SPOTIFY_AUTH_SCOPES.slice(),
    };
}

export async function refreshAccessToken(): Promise<SpotifyTokens> {
    const refreshToken = spotifyAuthState$.refreshToken.peek();
    if (!refreshToken) {
        throw new Error("No refresh token available for Spotify refresh");
    }

    const token = await fetchToken({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });

    const expiresAt = Date.now() + token.expires_in * 1000 - 60_000;
    const nextRefresh = token.refresh_token ?? refreshToken;
    return {
        accessToken: token.access_token,
        refreshToken: nextRefresh,
        expiresAt,
        scope: token.scope ? token.scope.split(" ") : spotifyAuthState$.scope.peek(),
    };
}

export async function ensureSpotifyAccessToken(): Promise<string | null> {
    const state = spotifyAuthState$.get();
    if (state.accessToken && state.expiresAt && state.expiresAt > Date.now() + 30_000) {
        return state.accessToken;
    }

    if (!state.refreshToken) {
        return null;
    }

    const tokens = await refreshAccessToken();
    setSpotifyTokens(tokens);
    return tokens.accessToken;
}

export async function loadSpotifyProfile(accessToken: string): Promise<SpotifyUserProfile> {
    const response = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to load Spotify profile: ${response.status} ${text}`);
    }
    const json = (await response.json()) as {
        id: string;
        display_name?: string;
        email?: string;
        country?: string;
        product?: string;
        uri?: string;
    };
    return {
        id: json.id,
        displayName: json.display_name,
        email: json.email,
        country: json.country,
        product: json.product,
        uri: json.uri,
    };
}

export async function completeSpotifyLogin(params: { code: string; state: string }): Promise<SpotifyAuthState> {
    const storedState = spotifyAuthState$.codeState.peek();
    const verifier = spotifyAuthState$.codeVerifier.peek();
    if (!verifier || !storedState || storedState !== params.state) {
        throw new Error("Spotify auth state mismatch");
    }

    const tokens = await exchangeCodeForToken(params.code, verifier);
    setSpotifyTokens(tokens);
    const profile = await loadSpotifyProfile(tokens.accessToken);
    setSpotifyUser(profile);
    setPKCEState(null, null);
    return spotifyAuthState$.get();
}

export async function logoutSpotify(): Promise<void> {
    clearSpotifyAuth();
}
