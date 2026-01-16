import { observable } from "@legendapp/state";
import type { YoutubeMusicPlaybackState } from "@/providers/youtubeMusic/playerState";

export interface YoutubeMusicWebPlayerState {
    isReady: boolean;
    lastError: string | null;
    lastState: YoutubeMusicPlaybackState | null;
}

export const youtubeMusicWebPlayerState$ = observable<YoutubeMusicWebPlayerState>({
    isReady: false,
    lastError: null,
    lastState: null,
});

export function setYoutubeMusicReady(isReady: boolean): void {
    youtubeMusicWebPlayerState$.isReady.set(isReady);
}

export function setYoutubeMusicWebPlayerError(message: string | null): void {
    youtubeMusicWebPlayerState$.lastError.set(message);
}

export function setYoutubeMusicWebPlayerState(payload: YoutubeMusicPlaybackState): void {
    youtubeMusicWebPlayerState$.lastState.set(payload);
}
