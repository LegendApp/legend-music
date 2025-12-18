import { observable } from "@legendapp/state";

export interface SpotifyWebPlayerState {
    deviceId: string | null;
    isReady: boolean;
    lastError: string | null;
    lastState: unknown;
}

export const spotifyWebPlayerState$ = observable<SpotifyWebPlayerState>({
    deviceId: null,
    isReady: false,
    lastError: null,
    lastState: null,
});

export function setSpotifyDevice(deviceId: string | null): void {
    spotifyWebPlayerState$.deviceId.set(deviceId);
    spotifyWebPlayerState$.isReady.set(Boolean(deviceId));
}

export function setSpotifyWebPlayerError(message: string | null): void {
    spotifyWebPlayerState$.lastError.set(message);
}

export function setSpotifyWebPlayerState(payload: unknown): void {
    spotifyWebPlayerState$.lastState.set(payload);
}
