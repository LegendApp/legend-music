import { useCallback, useEffect, useRef } from "react";
import { logYoutubeMusicDebug, shouldLogYoutubeMusic } from "@/providers/youtubeMusic/logging";
import type { YoutubeMusicPlaybackState } from "@/providers/youtubeMusic/playerState";
import {
    setYoutubeMusicReady,
    setYoutubeMusicWebPlayerError,
    setYoutubeMusicWebPlayerState,
} from "@/providers/youtubeMusic/webPlayerState";
import {
    YoutubeMusicWebPlayerHost,
    type YoutubeMusicWebPlayerHandle,
} from "@/providers/youtubeMusic/YoutubeMusicWebPlayerHost";
import { audioPlayerState$ } from "@/components/AudioPlayer";
import { activeProviderId$ } from "@/providers/providerRegistry";

let webPlayerHandle: YoutubeMusicWebPlayerHandle | null = null;

export function loadYoutubeMusicUrl(url: string): void {
    if (!webPlayerHandle) {
        logYoutubeMusicDebug("[YoutubeMusicWebPlayerBridge] load requested before host ready", { url });
        return;
    }
    webPlayerHandle.load(url);
}

export function playYoutubeMusic(): void {
    if (!webPlayerHandle) {
        return;
    }
    webPlayerHandle.play();
}

export function pauseYoutubeMusic(): void {
    if (!webPlayerHandle) {
        return;
    }
    webPlayerHandle.pause();
}

export function seekYoutubeMusic(positionSeconds: number): void {
    if (!webPlayerHandle) {
        return;
    }
    webPlayerHandle.seek(positionSeconds);
}

export function setYoutubeMusicVolume(volume: number): void {
    if (!webPlayerHandle) {
        return;
    }
    webPlayerHandle.setVolume(volume);
}

export function requestYoutubeMusicState(): void {
    if (!webPlayerHandle) {
        return;
    }
    webPlayerHandle.requestState();
}

export function YoutubeMusicWebPlayerBridge() {
    const webPlayerRef = useRef<YoutubeMusicWebPlayerHandle>(null);

    useEffect(() => {
        webPlayerHandle = webPlayerRef.current;
        return () => {
            if (webPlayerHandle === webPlayerRef.current) {
                webPlayerHandle = null;
            }
        };
    }, []);

    const handleReady = useCallback(() => {
        logYoutubeMusicDebug("[YoutubeMusicWebPlayerBridge] ready");
        setYoutubeMusicReady(true);
    }, []);

    const handleState = useCallback((state: YoutubeMusicPlaybackState) => {
        const activeProviderId = activeProviderId$.peek();
        const currentTrack = audioPlayerState$.currentTrack.peek();
        const isPlaying = audioPlayerState$.isPlaying.peek();
        const isYoutubePlaybackActive =
            activeProviderId === "youtubeMusic" && currentTrack?.provider === "youtubeMusic" && isPlaying;

        if (!isYoutubePlaybackActive) {
            if (shouldLogYoutubeMusic()) {
                logYoutubeMusicDebug("[YoutubeMusicWebPlayerBridge] state ignored", {
                    activeProviderId,
                    isPlaying,
                    currentTrackProvider: currentTrack?.provider,
                });
            }
            return;
        }

        if (shouldLogYoutubeMusic()) {
            logYoutubeMusicDebug("[YoutubeMusicWebPlayerBridge] state", state);
        }
        setYoutubeMusicWebPlayerState(state);
    }, []);

    const handleError = useCallback((message: string) => {
        logYoutubeMusicDebug("[YoutubeMusicWebPlayerBridge] error", { message });
        setYoutubeMusicWebPlayerError(message);
    }, []);

    return (
        <YoutubeMusicWebPlayerHost
            ref={webPlayerRef}
            onReady={handleReady}
            onState={handleState}
            onError={handleError}
        />
    );
}
