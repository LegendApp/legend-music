import { appleMusicNative } from "@/native-modules/AppleMusic";
import {
    clearAppleMusicAuth,
    setAppleMusicDeveloperToken,
    setAppleMusicStorefront,
    setAppleMusicUser,
    setAppleMusicUserToken,
    appleMusicAuthState$,
} from "./authState";
import { APPLE_MUSIC_DEVELOPER_TOKEN_URL } from "./constants";
import type { AppleMusicAuthState } from "./types";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type DeveloperTokenResponse = {
    token?: string;
    developerToken?: string;
    expiresAt?: number;
    expiresIn?: number;
};

const parseDeveloperTokenResponse = (payload: string): { token: string; expiresAt: number | null } => {
    const trimmed = payload.trim();
    if (!trimmed) {
        throw new Error("Empty Apple Music developer token response");
    }

    try {
        const json = JSON.parse(trimmed) as DeveloperTokenResponse;
        const token = json.token ?? json.developerToken;
        if (!token) {
            throw new Error("Missing Apple Music developer token in response");
        }
        const expiresAt =
            typeof json.expiresAt === "number"
                ? json.expiresAt
                : typeof json.expiresIn === "number"
                  ? Date.now() + json.expiresIn * 1000 - TOKEN_EXPIRY_BUFFER_MS
                  : null;
        return { token, expiresAt };
    } catch (error) {
        if (error instanceof SyntaxError) {
            return { token: trimmed, expiresAt: null };
        }
        throw error;
    }
};

export async function fetchAppleMusicDeveloperToken(): Promise<{ token: string; expiresAt: number | null }> {
    // TODO: Replace TEMPORARY_URL with your backend endpoint that returns a developer token.
    const response = await fetch(APPLE_MUSIC_DEVELOPER_TOKEN_URL);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Apple Music token error ${response.status}: ${text}`);
    }

    const payload = await response.text();
    return parseDeveloperTokenResponse(payload);
}

export async function ensureAppleMusicDeveloperToken(): Promise<string | null> {
    const state = appleMusicAuthState$.get();
    const isValid =
        state.developerToken &&
        (!state.developerTokenExpiresAt || state.developerTokenExpiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS);
    if (isValid) {
        return state.developerToken;
    }

    const { token, expiresAt } = await fetchAppleMusicDeveloperToken();
    setAppleMusicDeveloperToken(token, expiresAt ?? null);
    return token;
}

export async function authorizeAppleMusic(): Promise<AppleMusicAuthState> {
    const developerToken = await ensureAppleMusicDeveloperToken();
    if (!developerToken) {
        throw new Error("Missing Apple Music developer token");
    }

    const result = await appleMusicNative.authorize({ developerToken });
    setAppleMusicUserToken(result.userToken ?? null, result.userTokenExpiresAt ?? null);
    setAppleMusicStorefront(result.storefront ?? null);
    setAppleMusicUser(result.user ?? null);
    return appleMusicAuthState$.get();
}

export async function logoutAppleMusic(): Promise<void> {
    await appleMusicNative.unauthorize();
    clearAppleMusicAuth();
}
