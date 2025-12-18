import { useCallback, useEffect, useRef, useState } from "react";
import { useValue } from "@legendapp/state/react";
import { ensureSpotifyAccessToken } from "@/providers/spotify/auth";
import { spotifyAuthState$ } from "@/providers/spotify/authState";
import { SpotifyWebPlayerHost, type SpotifyWebPlayerHandle } from "@/providers/spotify/SpotifyWebPlayerHost";
import {
    setSpotifyDevice,
    setSpotifyWebPlayerError,
    setSpotifyWebPlayerState,
    spotifyWebPlayerState$,
} from "@/providers/spotify/webPlayerState";

export function SpotifyWebPlayerBridge() {
    const auth = useValue(spotifyAuthState$);
    const [token, setToken] = useState<string | null>(null);
    const webPlayerRef = useRef<SpotifyWebPlayerHandle>(null);

    const refreshTokenIfNeeded = useCallback(async () => {
        try {
            const nextToken = await ensureSpotifyAccessToken();
            setToken(nextToken);
            return nextToken;
        } catch (error) {
            setSpotifyWebPlayerError(error instanceof Error ? error.message : String(error));
            return null;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        refreshTokenIfNeeded().catch((error) => {
            if (cancelled) {
                return;
            }
            setSpotifyWebPlayerError(error instanceof Error ? error.message : String(error));
        });

        return () => {
            cancelled = true;
        };
    }, [auth.accessToken, auth.expiresAt, auth.refreshToken, refreshTokenIfNeeded]);

    const handleTokenRequest = useCallback(async () => refreshTokenIfNeeded(), [refreshTokenIfNeeded]);

    const handleReady = useCallback((deviceId: string) => {
        setSpotifyDevice(deviceId);
        spotifyWebPlayerState$.lastError.set(null);
    }, []);

    const handleNotReady = useCallback((deviceId?: string) => {
        if (spotifyWebPlayerState$.deviceId.peek() === deviceId) {
            setSpotifyDevice(null);
        }
    }, []);

    const handleState = useCallback((state: unknown) => {
        setSpotifyWebPlayerState(state);
    }, []);

    const handleError = useCallback((kind: string, message?: string) => {
        setSpotifyWebPlayerError(message ?? kind);
    }, []);

    if (!auth.refreshToken && !auth.accessToken) {
        return null;
    }

    return (
        <SpotifyWebPlayerHost
            ref={webPlayerRef}
            accessToken={token}
            onReady={handleReady}
            onNotReady={handleNotReady}
            onState={handleState}
            onError={handleError}
            onTokenRequest={handleTokenRequest}
        />
    );
}
