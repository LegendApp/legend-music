import { useCallback, useEffect, useRef, useState } from "react";
import { useValue } from "@legendapp/state/react";
import { ensureSpotifyAccessToken } from "@/providers/spotify/auth";
import { spotifyAuthState$ } from "@/providers/spotify/authState";
import { logSpotifyDebug, shouldLogSpotify, warnSpotifyDebug } from "@/providers/spotify/logging";
import type { SpotifyPlaybackState } from "@/providers/spotify/playerState";
import { SpotifyWebPlayerHost, type SpotifyWebPlayerHandle } from "@/providers/spotify/SpotifyWebPlayerHost";
import {
    setSpotifyDevice,
    setSpotifyWebPlayerError,
    setSpotifyWebPlayerState,
    spotifyWebPlayerState$,
} from "@/providers/spotify/webPlayerState";

let webPlayerHandle: SpotifyWebPlayerHandle | null = null;

export function activateSpotifyWebPlayer(): void {
    if (!webPlayerHandle) {
        warnSpotifyDebug("[SpotifyWebPlayerBridge] activate requested before host is ready");
        return;
    }

    logSpotifyDebug("[SpotifyWebPlayerBridge] activate requested");
    webPlayerHandle.activate();
}

export function SpotifyWebPlayerBridge() {
    const auth = useValue(spotifyAuthState$);
    const [token, setToken] = useState<string | null>(null);
    const webPlayerRef = useRef<SpotifyWebPlayerHandle>(null);

    const refreshTokenIfNeeded = useCallback(async () => {
        try {
            const nextToken = await ensureSpotifyAccessToken();
            setToken(nextToken);
            logSpotifyDebug("[SpotifyWebPlayerBridge] token refresh", { hasToken: Boolean(nextToken) });
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

    useEffect(() => {
        webPlayerHandle = webPlayerRef.current;

        return () => {
            if (webPlayerHandle === webPlayerRef.current) {
                webPlayerHandle = null;
            }
        };
    }, []);

    const handleTokenRequest = useCallback(async () => refreshTokenIfNeeded(), [refreshTokenIfNeeded]);

    const handleReady = useCallback((deviceId: string) => {
        logSpotifyDebug("[SpotifyWebPlayerBridge] player ready", { deviceId });
        setSpotifyDevice(deviceId);
        spotifyWebPlayerState$.lastError.set(null);
    }, []);

    const handleNotReady = useCallback((deviceId?: string) => {
        logSpotifyDebug("[SpotifyWebPlayerBridge] player not ready", { deviceId });
        if (spotifyWebPlayerState$.deviceId.peek() === deviceId) {
            setSpotifyDevice(null);
        }
    }, []);

    const handleState = useCallback((state: unknown) => {
        if (shouldLogSpotify()) {
            const snapshot = state as SpotifyPlaybackState;
            logSpotifyDebug("[SpotifyWebPlayerBridge] state", {
                deviceId: spotifyWebPlayerState$.deviceId.peek(),
                isReady: spotifyWebPlayerState$.isReady.peek(),
                trackUri: snapshot.track_window?.current_track?.uri ?? snapshot.track_window?.current_track?.id,
                positionMs: snapshot.position,
                durationMs: snapshot.duration,
                paused: snapshot.paused,
                timestamp: snapshot.timestamp,
            });
        }
        setSpotifyWebPlayerState(state);
    }, []);

    const handleError = useCallback((kind: string, message?: string) => {
        logSpotifyDebug("[SpotifyWebPlayerBridge] player error", { kind, message });
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
