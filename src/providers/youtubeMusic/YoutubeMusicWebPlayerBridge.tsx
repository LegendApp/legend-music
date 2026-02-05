import { useCallback } from "react";
import { useValue } from "@legendapp/state/react";
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

type YoutubeMusicWebCommand =
    | { type: "load"; payload: { url: string } }
    | { type: "play" }
    | { type: "pause" }
    | { type: "seek"; payload: { positionSeconds: number } }
    | { type: "set-volume"; payload: { volume: number } }
    | { type: "request-state" };

let webPlayerHandle: YoutubeMusicWebPlayerHandle | null = null;
let isWebPlayerReady = false;
const pendingCommands: YoutubeMusicWebCommand[] = [];

const runCommand = (handle: YoutubeMusicWebPlayerHandle, command: YoutubeMusicWebCommand): void => {
    switch (command.type) {
        case "load":
            handle.load(command.payload.url);
            break;
        case "play":
            handle.play();
            break;
        case "pause":
            handle.pause();
            break;
        case "seek":
            handle.seek(command.payload.positionSeconds);
            break;
        case "set-volume":
            handle.setVolume(command.payload.volume);
            break;
        case "request-state":
            handle.requestState();
            break;
        default:
            break;
    }
};

const queueCommand = (command: YoutubeMusicWebCommand): void => {
    pendingCommands.push(command);
    if (shouldLogYoutubeMusic()) {
        logYoutubeMusicDebug("[YoutubeMusicWebPlayerBridge] command queued", command);
    }
};

const flushPendingCommands = (): void => {
    if (!webPlayerHandle || !isWebPlayerReady || pendingCommands.length === 0) {
        return;
    }

    const commands = pendingCommands.splice(0, pendingCommands.length);
    for (const command of commands) {
        runCommand(webPlayerHandle, command);
    }
};

const sendOrQueueCommand = (command: YoutubeMusicWebCommand): void => {
    if (!webPlayerHandle || !isWebPlayerReady) {
        queueCommand(command);
        return;
    }

    runCommand(webPlayerHandle, command);
};

export function loadYoutubeMusicUrl(url: string): void {
    if (!webPlayerHandle || !isWebPlayerReady) {
        logYoutubeMusicDebug("[YoutubeMusicWebPlayerBridge] load queued until host ready", { url });
    }
    sendOrQueueCommand({ type: "load", payload: { url } });
}

export function playYoutubeMusic(): void {
    sendOrQueueCommand({ type: "play" });
}

export function pauseYoutubeMusic(): void {
    sendOrQueueCommand({ type: "pause" });
}

export function seekYoutubeMusic(positionSeconds: number): void {
    sendOrQueueCommand({ type: "seek", payload: { positionSeconds } });
}

export function setYoutubeMusicVolume(volume: number): void {
    sendOrQueueCommand({ type: "set-volume", payload: { volume } });
}

export function requestYoutubeMusicState(): void {
    sendOrQueueCommand({ type: "request-state" });
}

export function YoutubeMusicWebPlayerBridge() {
    const shouldRender = useValue(() => {
        const currentTrack = audioPlayerState$.currentTrack.get();
        return currentTrack?.provider === "youtubeMusic";
    });

    const handleWebPlayerRef = useCallback((instance: YoutubeMusicWebPlayerHandle | null) => {
        webPlayerHandle = instance;
        isWebPlayerReady = false;
        setYoutubeMusicReady(false);
        if (!instance) {
            pendingCommands.length = 0;
        }
    }, []);

    const handleReady = useCallback(() => {
        logYoutubeMusicDebug("[YoutubeMusicWebPlayerBridge] ready");
        isWebPlayerReady = true;
        setYoutubeMusicReady(true);
        flushPendingCommands();
    }, []);

    const handleState = useCallback((state: YoutubeMusicPlaybackState) => {
        const currentTrack = audioPlayerState$.currentTrack.peek();
        const activeProviderId = currentTrack ? (currentTrack.provider ?? "local") : null;
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

    if (!shouldRender) {
        return null;
    }

    return (
        <YoutubeMusicWebPlayerHost
            ref={handleWebPlayerRef}
            onReady={handleReady}
            onState={handleState}
            onError={handleError}
        />
    );
}
