import { appleMusicNative } from "@/native-modules/AppleMusic";
import {
    clearAppleMusicAuth,
    setAppleMusicDeveloperToken,
    setAppleMusicStorefront,
    setAppleMusicUser,
    setAppleMusicUserToken,
    appleMusicAuthState$,
} from "./authState";
import { clearAppleMusicPlaylistsCache } from "./playlistsState";
import type { AppleMusicAuthState } from "./types";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

const decodeBase64Url = (value: string): string | null => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    try {
        if (typeof atob === "function") {
            return atob(padded);
        }
        return Buffer.from(padded, "base64").toString("utf8");
    } catch {
        return null;
    }
};

const parseDeveloperTokenExpiresAt = (token: string): number | null => {
    const parts = token.split(".");
    if (parts.length < 2) {
        return null;
    }

    const decoded = decodeBase64Url(parts[1]);
    if (!decoded) {
        return null;
    }

    try {
        const payload = JSON.parse(decoded) as { exp?: number };
        if (typeof payload.exp !== "number") {
            return null;
        }
        return payload.exp * 1000;
    } catch {
        return null;
    }
};

const parseDeveloperToken = (token: string): { token: string; expiresAt: number | null } => {
    const trimmed = token.trim();
    if (!trimmed) {
        throw new Error("Empty Apple Music developer token");
    }

    return { token: trimmed, expiresAt: parseDeveloperTokenExpiresAt(trimmed) };
};

export async function fetchAppleMusicDeveloperToken(): Promise<{ token: string; expiresAt: number | null }> {
    const token = await appleMusicNative.getDeveloperToken();
    return parseDeveloperToken(token);
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
    clearAppleMusicPlaylistsCache();
}
