import { SPOTIFY_API_BASE, SPOTIFY_DEVICE_NAME } from "@/providers/spotify/constants";
import { ensureSpotifyAccessToken } from "./auth";
import { errorSpotifyDebug, logSpotifyDebug, shouldLogSpotify, warnSpotifyDebug } from "./logging";
import { spotifyWebPlayerState$ } from "./webPlayerState";

type PlayRequest = {
    uri: string;
    positionMs?: number;
    deviceId?: string;
};

type SpotifyDevice = {
    id?: string;
    name?: string;
    is_active?: boolean;
    type?: string;
    volume_percent?: number;
};

type SpotifyPlayerState = {
    device?: SpotifyDevice;
    is_playing?: boolean;
    progress_ms?: number;
    item?: {
        uri?: string;
        id?: string;
        name?: string;
    };
};

type SpotifyDevicesResponse = {
    devices?: SpotifyDevice[];
};

const buildHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
});

const DEVICE_READY_TIMEOUT_MS = 5000;
const summarizeDevice = (device?: SpotifyDevice): Record<string, unknown> | null =>
    device
        ? {
              id: device.id,
              name: device.name,
              isActive: device.is_active,
              type: device.type,
              volumePercent: device.volume_percent,
          }
        : null;

const summarizeItem = (item?: SpotifyPlayerState["item"]): Record<string, unknown> | null =>
    item
        ? {
              uri: item.uri,
              id: item.id,
              name: item.name,
          }
        : null;

async function getDeviceId(deviceId?: string): Promise<string> {
    if (deviceId) {
        logSpotifyDebug("[SpotifyPlayback] getDeviceId", { source: "request", deviceId });
        return deviceId;
    }

    const current = spotifyWebPlayerState$.deviceId.peek();
    if (current) {
        logSpotifyDebug("[SpotifyPlayback] getDeviceId", {
            source: "web-player",
            deviceId: current,
            isReady: spotifyWebPlayerState$.isReady.peek(),
        });
        return current;
    }

    warnSpotifyDebug("[SpotifyPlayback] waiting for device id", {
        isReady: spotifyWebPlayerState$.isReady.peek(),
        lastError: spotifyWebPlayerState$.lastError.peek(),
    });

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
            logSpotifyDebug("[SpotifyPlayback] getDeviceId resolved", { source: "listener", deviceId: value });
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
            warnSpotifyDebug("[SpotifyPlayback] getDeviceId timeout", { timeoutMs: DEVICE_READY_TIMEOUT_MS });
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

async function logSpotifyDevices(context: string): Promise<void> {
    if (!shouldLogSpotify()) {
        return;
    }

    try {
        const response = await apiFetch("/me/player/devices");
        if (response.status === 204) {
            logSpotifyDebug("[SpotifyPlayback] devices", { context, devices: [] });
            return;
        }
        if (!response.ok) {
            logSpotifyDebug("[SpotifyPlayback] devices", { context, status: response.status });
            return;
        }

        const json = (await response.json()) as SpotifyDevicesResponse;
        const devices = (json.devices ?? []).map((device) => summarizeDevice(device));
        logSpotifyDebug("[SpotifyPlayback] devices", { context, devices });
    } catch (error) {
        errorSpotifyDebug("[SpotifyPlayback] devices error", error, { context });
    }
}

async function logSpotifyPlayerSnapshot(context: string): Promise<void> {
    if (!shouldLogSpotify()) {
        return;
    }

    try {
        const response = await apiFetch("/me/player");
        if (response.status === 204) {
            logSpotifyDebug("[SpotifyPlayback] player snapshot", { context, status: 204, isPlaying: false });
            return;
        }
        if (!response.ok) {
            logSpotifyDebug("[SpotifyPlayback] player snapshot", { context, status: response.status });
            return;
        }

        const json = (await response.json()) as SpotifyPlayerState;
        logSpotifyDebug("[SpotifyPlayback] player snapshot", {
            context,
            isPlaying: json.is_playing,
            progressMs: json.progress_ms,
            item: summarizeItem(json.item),
            device: summarizeDevice(json.device),
        });
    } catch (error) {
        errorSpotifyDebug("[SpotifyPlayback] player snapshot error", error, { context });
    }
}

export async function transferSpotifyPlayback(deviceId?: string, play = false): Promise<void> {
    const targetDevice = await getDeviceId(deviceId);
    logSpotifyDebug("[SpotifyPlayback] transfer request", { deviceId: targetDevice, play });
    void logSpotifyDevices("before transfer");
    void logSpotifyPlayerSnapshot("before transfer");
    const response = await apiFetch("/me/player", {
        method: "PUT",
        body: JSON.stringify({
            device_ids: [targetDevice],
            play,
        }),
    });

    logSpotifyDebug("[SpotifyPlayback] transfer response", { deviceId: targetDevice, play, status: response.status });
    if (!response.ok) {
        throw new Error(`Failed to transfer playback to ${SPOTIFY_DEVICE_NAME}: ${response.status}`);
    }

    void logSpotifyDevices("after transfer");
    void logSpotifyPlayerSnapshot("after transfer");
}

export async function playSpotifyUri(request: PlayRequest): Promise<void> {
    const deviceId = await getDeviceId(request.deviceId);
    const positionMs = request.positionMs ?? 0;
    logSpotifyDebug("[SpotifyPlayback] play request", { deviceId, uri: request.uri, positionMs });
    void logSpotifyDevices("before play");
    void logSpotifyPlayerSnapshot("before play");
    const body = {
        uris: [request.uri],
        position_ms: positionMs,
    };
    const response = await apiFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        body: JSON.stringify(body),
    });

    logSpotifyDebug("[SpotifyPlayback] play response", { deviceId, uri: request.uri, status: response.status });
    if (!response.ok) {
        const text = await response.text();
        errorSpotifyDebug("[SpotifyPlayback] play failed", text, {
            deviceId,
            uri: request.uri,
            positionMs,
            status: response.status,
        });
        throw new Error(`Failed to start Spotify playback: ${response.status} ${text}`);
    }

    void logSpotifyPlayerSnapshot("after play");
}

export async function pauseSpotify(deviceId?: string): Promise<void> {
    const targetDevice = await getDeviceId(deviceId);
    logSpotifyDebug("[SpotifyPlayback] pause request", { deviceId: targetDevice });
    const response = await apiFetch(`/me/player/pause?device_id=${encodeURIComponent(targetDevice)}`, {
        method: "PUT",
    });

    logSpotifyDebug("[SpotifyPlayback] pause response", { deviceId: targetDevice, status: response.status });
    if (!response.ok && response.status !== 404) {
        const text = await response.text();
        throw new Error(`Failed to pause Spotify playback: ${response.status} ${text}`);
    }
}

export async function resumeSpotify(deviceId?: string): Promise<void> {
    const targetDevice = await getDeviceId(deviceId);
    logSpotifyDebug("[SpotifyPlayback] resume request", { deviceId: targetDevice });
    const response = await apiFetch(`/me/player/play?device_id=${encodeURIComponent(targetDevice)}`, {
        method: "PUT",
    });

    logSpotifyDebug("[SpotifyPlayback] resume response", { deviceId: targetDevice, status: response.status });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to resume Spotify playback: ${response.status} ${text}`);
    }
}

export async function seekSpotify(positionMs: number, deviceId?: string): Promise<void> {
    const targetDevice = await getDeviceId(deviceId);
    logSpotifyDebug("[SpotifyPlayback] seek request", { deviceId: targetDevice, positionMs });
    const response = await apiFetch(
        `/me/player/seek?position_ms=${encodeURIComponent(positionMs)}&device_id=${encodeURIComponent(targetDevice)}`,
        {
            method: "PUT",
        },
    );

    logSpotifyDebug("[SpotifyPlayback] seek response", { deviceId: targetDevice, positionMs, status: response.status });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to seek Spotify playback: ${response.status} ${text}`);
    }
}

export async function setSpotifyVolume(volume: number, deviceId?: string): Promise<void> {
    const targetDevice = await getDeviceId(deviceId);
    const percentage = Math.max(0, Math.min(100, Math.round(volume * 100)));
    logSpotifyDebug("[SpotifyPlayback] volume request", { deviceId: targetDevice, percentage });
    const response = await apiFetch(
        `/me/player/volume?volume_percent=${percentage}&device_id=${encodeURIComponent(targetDevice)}`,
        {
            method: "PUT",
        },
    );

    logSpotifyDebug("[SpotifyPlayback] volume response", { deviceId: targetDevice, percentage, status: response.status });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to set Spotify volume: ${response.status} ${text}`);
    }
}
