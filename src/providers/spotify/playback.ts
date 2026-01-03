import { SPOTIFY_API_BASE, SPOTIFY_DEVICE_NAME } from "@/providers/spotify/constants";
import { ensureSpotifyAccessToken } from "./auth";
import { spotifyWebPlayerState$ } from "./webPlayerState";

type PlayRequest = {
    uri: string;
    positionMs?: number;
    deviceId?: string;
};

const buildHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
});

const DEVICE_READY_TIMEOUT_MS = 5000;

async function getDeviceId(deviceId?: string): Promise<string> {
    if (deviceId) {
        return deviceId;
    }

    const current = spotifyWebPlayerState$.deviceId.peek();
    if (current) {
        return current;
    }

    if (__DEV__) {
        console.warn("[SpotifyPlayback] waiting for device id", {
            deviceId,
            webPlayerState: spotifyWebPlayerState$.get(),
        });
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let unsubscribe = () => {};

        const cleanup = () => {
            if (settled) {
                return;
            }
            settled = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            unsubscribe();
        };

        unsubscribe = spotifyWebPlayerState$.deviceId.onChange(({ value }) => {
            if (!value) {
                return;
            }
            cleanup();
            resolve(value);
        });

        if (settled) {
            unsubscribe();
            return;
        }

        const updated = spotifyWebPlayerState$.deviceId.peek();
        if (updated) {
            cleanup();
            resolve(updated);
            return;
        }

        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error("Spotify player is not ready. Connect the Web Playback SDK first."));
        }, DEVICE_READY_TIMEOUT_MS);
    });
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await ensureSpotifyAccessToken();
    if (!token) {
        throw new Error("Spotify auth required before playback.");
    }
    const headers = {
        ...init.headers,
        ...buildHeaders(token),
    };
    const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
        ...init,
        headers,
    });
    return response;
}

export async function transferSpotifyPlayback(deviceId?: string, play = false): Promise<void> {
    const targetDevice = await getDeviceId(deviceId);
    if (__DEV__) {
        console.log("[SpotifyPlayback] transfer", { deviceId: targetDevice, play });
    }
    const response = await apiFetch("/me/player", {
        method: "PUT",
        body: JSON.stringify({
            device_ids: [targetDevice],
            play,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to transfer playback to ${SPOTIFY_DEVICE_NAME}: ${response.status}`);
    }
}

export async function playSpotifyUri(request: PlayRequest): Promise<void> {
    const deviceId = await getDeviceId(request.deviceId);
    if (__DEV__) {
        console.log("[SpotifyPlayback] play", { deviceId, uri: request.uri });
    }
    console.log("playing uri", request);
    const body = {
        uris: [request.uri],
        position_ms: request.positionMs ?? 0,
    };
    const response = await apiFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to start Spotify playback: ${response.status} ${text}`);
    }
}

export async function pauseSpotify(deviceId?: string): Promise<void> {
    const targetDevice = await getDeviceId(deviceId);
    const response = await apiFetch(`/me/player/pause?device_id=${encodeURIComponent(targetDevice)}`, {
        method: "PUT",
    });

    if (!response.ok && response.status !== 404) {
        const text = await response.text();
        throw new Error(`Failed to pause Spotify playback: ${response.status} ${text}`);
    }
}

export async function resumeSpotify(deviceId?: string): Promise<void> {
    console.log("resuming spotify");
    const targetDevice = await getDeviceId(deviceId);
    const response = await apiFetch(`/me/player/play?device_id=${encodeURIComponent(targetDevice)}`, {
        method: "PUT",
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to resume Spotify playback: ${response.status} ${text}`);
    }
}

export async function seekSpotify(positionMs: number, deviceId?: string): Promise<void> {
    const targetDevice = await getDeviceId(deviceId);
    const response = await apiFetch(
        `/me/player/seek?position_ms=${encodeURIComponent(positionMs)}&device_id=${encodeURIComponent(targetDevice)}`,
        {
            method: "PUT",
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to seek Spotify playback: ${response.status} ${text}`);
    }
}

export async function setSpotifyVolume(volume: number, deviceId?: string): Promise<void> {
    const targetDevice = await getDeviceId(deviceId);
    const percentage = Math.max(0, Math.min(100, Math.round(volume * 100)));
    const response = await apiFetch(
        `/me/player/volume?volume_percent=${percentage}&device_id=${encodeURIComponent(targetDevice)}`,
        {
            method: "PUT",
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to set Spotify volume: ${response.status} ${text}`);
    }
}
