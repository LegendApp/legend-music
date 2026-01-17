import { type PlaybackProvider, type PlaybackStateUpdate } from "@/providers/types";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { parseDurationToSeconds } from "@/utils/m3u";
import { appleMusicNative, type AppleMusicPlaybackState } from "@/native-modules/AppleMusic";
import { ensureAppleMusicDeveloperToken } from "@/providers/appleMusic/auth";
import { appleMusicAuthState$ } from "@/providers/appleMusic/authState";
import { getAppleMusicTrackId } from "@/providers/appleMusic/trackMapping";

const stateHandlers = new Set<(update: PlaybackStateUpdate) => void>();
let subscriptionInitialized = false;
let currentTrackId: string | null = null;

const emitStateUpdate = (update: PlaybackStateUpdate): void => {
    for (const handler of stateHandlers) {
        handler(update);
    }
};

const handleNativeState = (state: AppleMusicPlaybackState): void => {
    if (state.trackId && currentTrackId && state.trackId !== currentTrackId) {
        return;
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
    if (typeof state.artworkUrl === "string") {
        update.artwork = state.artworkUrl;
    }
    if (state.didComplete) {
        update.didComplete = true;
    }
    if (typeof state.error === "string") {
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
    appleMusicNative.addListener("onPlaybackState", (state) => {
        handleNativeState(state as AppleMusicPlaybackState);
    });
    appleMusicNative.addListener("onPlaybackError", ({ error }) => {
        if (!currentTrackId) {
            return;
        }
        emitStateUpdate({ error });
    });
};

const getDurationSeconds = (track: LocalTrack): number => {
    if (typeof track.durationMs === "number") {
        return track.durationMs / 1000;
    }

    const parsed = parseDurationToSeconds(track.duration);
    return Number.isFinite(parsed) ? parsed : 0;
};

const ensureAppleMusicConfigured = async (): Promise<void> => {
    const developerToken = await ensureAppleMusicDeveloperToken();
    const userToken = appleMusicAuthState$.userToken.peek();
    if (!developerToken || !userToken) {
        throw new Error("Apple Music authorization required before playback");
    }

    await appleMusicNative.configure({ developerToken, userToken });
};

export const appleMusicPlaybackProvider: PlaybackProvider = {
    id: "appleMusic",
    canHandle: (track) => track.provider === "appleMusic",
    startsPlaybackOnLoad: true,
    onStateChange: (handler) => {
        stateHandlers.add(handler);
        ensureSubscription();
        return () => {
            stateHandlers.delete(handler);
        };
    },
    async load(track, options) {
        const trackId =
            getAppleMusicTrackId(track.uri) ??
            getAppleMusicTrackId(track.filePath) ??
            getAppleMusicTrackId(track.id);
        if (!trackId) {
            throw new Error("Missing Apple Music track id");
        }

        const startPositionSeconds =
            typeof options?.startPositionSeconds === "number" && Number.isFinite(options.startPositionSeconds)
                ? Math.max(0, options.startPositionSeconds)
                : 0;

        currentTrackId = trackId;
        await ensureAppleMusicConfigured();
        await appleMusicNative.loadTrack({ trackId, startPositionSeconds });

        emitStateUpdate({
            durationSeconds: getDurationSeconds(track),
            isLoading: true,
            isPlaying: true,
        });
    },
    async play() {
        await appleMusicNative.play();
        emitStateUpdate({ isPlaying: true });
    },
    async pause() {
        await appleMusicNative.pause();
        emitStateUpdate({ isPlaying: false });
    },
    async seek(positionSeconds) {
        await appleMusicNative.seek(positionSeconds);
        emitStateUpdate({ positionSeconds });
    },
    async setVolume(volume) {
        await appleMusicNative.setVolume(volume);
    },
    async stop() {
        currentTrackId = null;
        await appleMusicNative.pause();
        emitStateUpdate({ isPlaying: false });
    },
    getDurationSeconds,
};
