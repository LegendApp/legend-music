import { File } from "expo-file-system/next";
import audioPlayerApi, { type NowPlayingInfoPayload } from "@/native-modules/AudioPlayer";
import { type PlaybackProvider, type PlaybackStateUpdate } from "@/providers/types";
import { DEBUG_AUDIO_LOGS } from "@/systems/constants";
import { ensureLocalTrackThumbnail, type LocalTrack } from "@/systems/LocalMusicState";
import { parseDurationToSeconds } from "@/utils/m3u";
import { perfCount, perfDelta, perfLog } from "@/utils/perfLogger";

export class LocalTrackNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LocalTrackNotFoundError";
    }
}

const audioPlayer: typeof audioPlayerApi | null = audioPlayerApi;
const stateHandlers = new Set<(update: PlaybackStateUpdate) => void>();
let listenersInitialized = false;

const emitStateUpdate = (update: PlaybackStateUpdate): void => {
    for (const handler of stateHandlers) {
        handler(update);
    }
};

const ensureListeners = (): void => {
    if (listenersInitialized || !audioPlayer) {
        return;
    }

    listenersInitialized = true;

    audioPlayer.addListener("onLoadSuccess", (data) => {
        perfCount("LocalAudioPlayer.onLoadSuccess");
        const delta = perfDelta("LocalAudioPlayer.onLoadSuccess");
        perfLog("LocalAudioPlayer.onLoadSuccess", { delta, data });
        if (__DEV__) {
            if (DEBUG_AUDIO_LOGS) {
                console.log("Audio loaded successfully:", data);
            }
        }
        emitStateUpdate({ durationSeconds: data.duration, isLoading: false, error: null });
        audioPlayer.updateNowPlayingInfo({ duration: data.duration });
    });

    audioPlayer.addListener("onLoadError", (data) => {
        perfCount("LocalAudioPlayer.onLoadError");
        const delta = perfDelta("LocalAudioPlayer.onLoadError");
        perfLog("LocalAudioPlayer.onLoadError", { delta, data });
        console.error("Audio load error:", data.error);
        emitStateUpdate({ error: data.error, isLoading: false, isPlaying: false });
    });

    audioPlayer.addListener("onPlaybackStateChanged", (data) => {
        emitStateUpdate({ isPlaying: data.isPlaying });
    });

    audioPlayer.addListener("onOcclusionChanged", ({ isOccluded }) => {
        emitStateUpdate({ isOccluded });
    });

    audioPlayer.addListener("onProgress", (data) => {
        emitStateUpdate({ positionSeconds: data.currentTime, durationSeconds: data.duration });
    });

    audioPlayer.addListener("onCompletion", () => {
        perfCount("LocalAudioPlayer.onCompletion");
        const delta = perfDelta("LocalAudioPlayer.onCompletion");
        perfLog("LocalAudioPlayer.onCompletion", { delta });
        if (__DEV__) {
            if (DEBUG_AUDIO_LOGS) {
                console.log("Track completed, playing next if available");
            }
        }
        emitStateUpdate({ didComplete: true });
    });

    audioPlayer.addListener("onRemoteCommand", ({ command }) => {
        perfCount("LocalAudioPlayer.onRemoteCommand");
        perfLog("LocalAudioPlayer.onRemoteCommand", { command });
        emitStateUpdate({ command });
    });
};

const normalizeTrackPathForFs = (path: string): string => {
    if (!path) {
        return path;
    }
    return path.startsWith("file://") ? path.replace("file://", "") : path;
};

const trackFileExists = (filePath: string): boolean => {
    try {
        const file = new File(normalizeTrackPathForFs(filePath));
        return file.exists;
    } catch (error) {
        console.warn("Failed to verify track existence", error);
        return true;
    }
};

const getDurationSeconds = (track: LocalTrack): number => {
    if (typeof track.durationMs === "number") {
        return track.durationMs / 1000;
    }
    const parsed = parseDurationToSeconds(track.duration);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const localPlaybackProvider: PlaybackProvider = {
    id: "local",
    canHandle: (track) => !track.provider || track.provider === "local",
    startsPlaybackOnLoad: false,
    isAvailable: () => Boolean(audioPlayer),
    onStateChange: (handler) => {
        stateHandlers.add(handler);
        ensureListeners();
        return () => {
            stateHandlers.delete(handler);
        };
    },
    async load(track, _options) {
        if (!audioPlayer) {
            throw new Error("Audio player unavailable");
        }

        if (!trackFileExists(track.filePath)) {
            throw new LocalTrackNotFoundError(`Track not found: ${track.filePath}`);
        }

        const nowPlayingUpdate: NowPlayingInfoPayload = {
            title: track.title,
            artist: track.artist,
            album: track.album,
            elapsedTime: 0,
        };

        if (track.thumbnail) {
            nowPlayingUpdate.artwork = track.thumbnail;
        }

        audioPlayer.updateNowPlayingInfo(nowPlayingUpdate);

        const result = await audioPlayer.loadTrack(track.filePath);
        if (!result.success) {
            throw new Error(result.error || "Failed to load track");
        }
    },
    async play() {
        if (!audioPlayer) {
            return;
        }
        await audioPlayer.play();
    },
    async pause() {
        if (!audioPlayer) {
            return;
        }
        await audioPlayer.pause();
    },
    async seek(positionSeconds) {
        if (!audioPlayer) {
            return;
        }
        await audioPlayer.seek(positionSeconds);
    },
    async setVolume(volume) {
        if (!audioPlayer) {
            return;
        }
        await audioPlayer.setVolume(volume);
    },
    async stop() {
        if (!audioPlayer) {
            return;
        }
        await audioPlayer.stop();
    },
    clearNowPlayingInfo() {
        audioPlayer?.clearNowPlayingInfo();
    },
    getDurationSeconds,
    async hydrateTrackMetadata(track) {
        const thumbnail = await ensureLocalTrackThumbnail(track);
        if (!thumbnail) {
            return null;
        }
        audioPlayer?.updateNowPlayingInfo({ artwork: thumbnail });
        return { thumbnail };
    },
};
