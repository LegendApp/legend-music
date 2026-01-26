import type { PlaybackProvider, PlaybackStateUpdate } from "@/providers/types";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { parseDurationToSeconds } from "@/utils/m3u";
import {
    loadYoutubeMusicUrl,
    pauseYoutubeMusic,
    playYoutubeMusic,
    requestYoutubeMusicState,
    seekYoutubeMusic,
    setYoutubeMusicVolume,
} from "@/providers/youtubeMusic/YoutubeMusicWebPlayerBridge";
import { logYoutubeMusicDebug, shouldLogYoutubeMusic } from "@/providers/youtubeMusic/logging";
import type { YoutubeMusicPlaybackState } from "@/providers/youtubeMusic/playerState";
import { getYoutubeMusicVideoId } from "@/providers/youtubeMusic/trackMapping";
import { youtubeMusicWebPlayerState$ } from "@/providers/youtubeMusic/webPlayerState";

const stateHandlers = new Set<(update: PlaybackStateUpdate) => void>();
let subscriptionInitialized = false;
let currentVideoId: string | null = null;
let pendingSeekSeconds: number | null = null;
let pendingPlay = false;
let pendingPlayAttempts = 0;
const MAX_PLAY_ATTEMPTS = 3;

const emitStateUpdate = (update: PlaybackStateUpdate): void => {
    for (const handler of stateHandlers) {
        handler(update);
    }
};

const resetPlaybackFlags = (): void => {
    pendingSeekSeconds = null;
    pendingPlay = false;
    pendingPlayAttempts = 0;
};

const buildYoutubeMusicUrl = (videoId: string): string =>
    `https://music.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

const shouldApplyPendingSeek = (state: YoutubeMusicPlaybackState): boolean =>
    typeof pendingSeekSeconds === "number" &&
    !Number.isNaN(pendingSeekSeconds) &&
    state.isLoading === false &&
    typeof state.durationSeconds === "number" &&
    state.durationSeconds > 0;

const handleStateUpdate = (state: YoutubeMusicPlaybackState): void => {
    if (shouldLogYoutubeMusic()) {
        logYoutubeMusicDebug("[YoutubeMusicPlaybackProvider] state", {
            ...state,
            currentVideoId,
            pendingSeekSeconds,
            pendingPlay,
            pendingPlayAttempts,
        });
    }

    if (pendingPlay) {
        if (state.isPlaying) {
            pendingPlay = false;
        } else if (state.isLoading === false && pendingPlayAttempts < MAX_PLAY_ATTEMPTS) {
            pendingPlayAttempts += 1;
            playYoutubeMusic();
        }
    }

    if (shouldApplyPendingSeek(state)) {
        const targetSeconds = Math.max(0, pendingSeekSeconds ?? 0);
        pendingSeekSeconds = null;
        seekYoutubeMusic(targetSeconds);
        emitStateUpdate({ positionSeconds: targetSeconds });
    }

    const update: PlaybackStateUpdate = {};
    if (typeof state.isPlaying === "boolean") {
        update.isPlaying = state.isPlaying;
    }
    if (typeof state.positionSeconds === "number") {
        update.positionSeconds = state.positionSeconds;
    }
    if (typeof state.durationSeconds === "number") {
        update.durationSeconds = state.durationSeconds;
    }
    if (typeof state.isLoading === "boolean") {
        update.isLoading = state.isLoading;
    }
    if (state.didComplete) {
        update.didComplete = true;
    }
    if (state.error) {
        update.error = state.error;
    }
    if (Object.keys(update).length > 0) {
        emitStateUpdate(update);
    }
};

const ensureSubscription = (): void => {
    if (subscriptionInitialized) {
        return;
    }

    subscriptionInitialized = true;
    youtubeMusicWebPlayerState$.lastState.onChange(({ value }) => {
        if (!value || !currentVideoId) {
            return;
        }
        handleStateUpdate(value);
    });
    youtubeMusicWebPlayerState$.lastError.onChange(({ value }) => {
        if (!currentVideoId) {
            return;
        }
        if (value) {
            emitStateUpdate({ error: value });
        }
    });
};

const getDurationSeconds = (track: LocalTrack): number => {
    if (typeof track.durationMs === "number") {
        return track.durationMs / 1000;
    }
    const parsed = parseDurationToSeconds(track.duration);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const youtubeMusicPlaybackProvider: PlaybackProvider = {
    id: "youtubeMusic",
    canHandle: (track) => track.provider === "youtubeMusic",
    startsPlaybackOnLoad: true,
    onStateChange: (handler) => {
        stateHandlers.add(handler);
        ensureSubscription();
        return () => {
            stateHandlers.delete(handler);
        };
    },
    async load(track, options) {
        const videoId =
            getYoutubeMusicVideoId(track.uri) ??
            getYoutubeMusicVideoId(track.filePath) ??
            getYoutubeMusicVideoId(track.id);
        if (!videoId) {
            throw new Error("Missing YouTube Music track id");
        }

        const startPositionSeconds =
            typeof options?.startPositionSeconds === "number" && Number.isFinite(options.startPositionSeconds)
                ? Math.max(0, options.startPositionSeconds)
                : 0;

        currentVideoId = videoId;
        resetPlaybackFlags();
        pendingSeekSeconds = startPositionSeconds > 0 ? startPositionSeconds : null;
        pendingPlay = true;

        const url = buildYoutubeMusicUrl(videoId);
        logYoutubeMusicDebug("[YoutubeMusicPlaybackProvider] load", { videoId, url, startPositionSeconds });
        loadYoutubeMusicUrl(url);
        playYoutubeMusic();
        requestYoutubeMusicState();

        emitStateUpdate({
            durationSeconds: getDurationSeconds(track),
            isLoading: true,
            isPlaying: true,
        });
    },
    async play() {
        pendingPlay = false;
        playYoutubeMusic();
        emitStateUpdate({ isPlaying: true });
    },
    async pause() {
        pendingPlay = false;
        pauseYoutubeMusic();
        emitStateUpdate({ isPlaying: false });
    },
    async seek(positionSeconds) {
        pendingSeekSeconds = null;
        seekYoutubeMusic(positionSeconds);
        emitStateUpdate({ positionSeconds });
    },
    async setVolume(volume) {
        setYoutubeMusicVolume(volume);
    },
    async stop() {
        currentVideoId = null;
        resetPlaybackFlags();
        pauseYoutubeMusic();
        emitStateUpdate({ isPlaying: false });
    },
    getDurationSeconds,
};
