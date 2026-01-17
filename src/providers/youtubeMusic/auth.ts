import Config from "react-native-config";
import { createPKCEChallenge } from "@/providers/spotify/pkce";
import {
    clearYoutubeMusicAuth,
    setYoutubeMusicPKCEState,
    setYoutubeMusicTokens,
    setYoutubeMusicUser,
    youtubeAuthState$,
} from "./authState";
import {
    YOUTUBE_AUTH_SCOPES,
    YOUTUBE_AUTH_URL,
    YOUTUBE_REDIRECT_URI,
    YOUTUBE_TOKEN_URL,
    YOUTUBE_USERINFO_URL,
} from "./constants";
import type { YoutubeAuthState, YoutubeTokens, YoutubeUserProfile } from "./authTypes";

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

const getYoutubeClientId = (): string => (Config.YOUTUBE_CLIENT_ID ?? "").trim();

const ensureYoutubeClientId = (): string => {
    const clientId = getYoutubeClientId();
    if (!clientId) {
        throw new Error("Missing YouTube client ID. Add it to the app config to enable login.");
    }
    return clientId;
};

export function buildYoutubeAuthorizeUrl(state: string, codeChallenge: string): string {
    const scopes = YOUTUBE_AUTH_SCOPES.join(" ");
    const clientId = ensureYoutubeClientId();
    const params = encodeForm({
        client_id: clientId,
        response_type: "code",
        redirect_uri: YOUTUBE_REDIRECT_URI,
        code_challenge_method: "S256",
        code_challenge: codeChallenge,
        scope: scopes,
        state,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
    });
    return `${YOUTUBE_AUTH_URL}?${params}`;
}

async function fetchToken(params: Record<string, string>): Promise<TokenResponse> {
    const clientId = ensureYoutubeClientId();
    const response = await fetch(YOUTUBE_TOKEN_URL, {
        method: "POST",
        headers: FORM_HEADERS,
        body: encodeForm({ client_id: clientId, ...params }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`YouTube token error ${response.status}: ${text}`);
    }

    return response.json() as Promise<TokenResponse>;
}

export async function startYoutubeMusicLogin(): Promise<{ authorizeUrl: string; state: string; verifier: string }> {
    const { verifier, challenge } = await createPKCEChallenge();
    const state = Math.random().toString(36).slice(2);
    setYoutubeMusicPKCEState(verifier, state);
    return {
        authorizeUrl: buildYoutubeAuthorizeUrl(state, challenge),
        state,
        verifier,
    };
}

export async function exchangeCodeForToken(code: string, verifier: string): Promise<YoutubeTokens> {
    const token = await fetchToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: YOUTUBE_REDIRECT_URI,
        code_verifier: verifier,
    });

    const expiresAt = Date.now() + token.expires_in * 1000 - 60_000;
    return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? youtubeAuthState$.refreshToken.peek(),
        expiresAt,
        scope: token.scope ? token.scope.split(" ") : YOUTUBE_AUTH_SCOPES.slice(),
    };
}

export async function refreshYoutubeMusicAccessToken(): Promise<YoutubeTokens> {
    const refreshToken = youtubeAuthState$.refreshToken.peek();
    if (!refreshToken) {
        throw new Error("No refresh token available for YouTube Music refresh");
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
        scope: token.scope ? token.scope.split(" ") : youtubeAuthState$.scope.peek(),
    };
}

export async function ensureYoutubeMusicAccessToken(): Promise<string | null> {
    const state = youtubeAuthState$.get();
    if (state.accessToken && state.expiresAt && state.expiresAt > Date.now() + 30_000) {
        return state.accessToken;
    }

    if (!state.refreshToken) {
        return null;
    }

    const tokens = await refreshYoutubeMusicAccessToken();
    setYoutubeMusicTokens(tokens);
    return tokens.accessToken;
}

export async function loadYoutubeUserProfile(accessToken: string): Promise<YoutubeUserProfile> {
    const response = await fetch(YOUTUBE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to load YouTube profile: ${response.status} ${text}`);
    }
    const json = (await response.json()) as {
        sub: string;
        name?: string;
        email?: string;
        picture?: string;
    };
    return {
        id: json.sub,
        displayName: json.name,
        email: json.email,
        picture: json.picture,
    };
}

export async function completeYoutubeMusicLogin(params: { code: string; state: string }): Promise<YoutubeAuthState> {
    const storedState = youtubeAuthState$.codeState.peek();
    const verifier = youtubeAuthState$.codeVerifier.peek();
    if (!verifier || !storedState || storedState !== params.state) {
        throw new Error("YouTube auth state mismatch");
    }

    const tokens = await exchangeCodeForToken(params.code, verifier);
    setYoutubeMusicTokens(tokens);
    if (!tokens.accessToken) {
        throw new Error("YouTube token exchange did not return an access token.");
    }
    const profile = await loadYoutubeUserProfile(tokens.accessToken);
    setYoutubeMusicUser(profile);
    setYoutubeMusicPKCEState(null, null);
    return youtubeAuthState$.get();
}

export async function logoutYoutubeMusic(): Promise<void> {
    clearYoutubeMusicAuth();
}
