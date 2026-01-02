import { type PlaybackProvider, type PlaybackStateUpdate } from "@/providers/types";
import { parseDurationToSeconds } from "@/utils/m3u";
import { activateSpotifyWebPlayer } from "./SpotifyWebPlayerBridge";
import {
    pauseSpotify,
    playSpotifyUri,
    resumeSpotify,
    seekSpotify,
    setSpotifyVolume,
    transferSpotifyPlayback,
} from "./playback";
import {
    getSpotifyStateArtwork,
    getSpotifyStateTrackKey,
    getSpotifyTrackKey,
    type SpotifyPlaybackState,
} from "./playerState";
import { spotifyWebPlayerState$ } from "./webPlayerState";
import type { LocalTrack } from "@/systems/LocalMusicState";

const stateHandlers = new Set<(update: PlaybackStateUpdate) => void>();
let subscriptionInitialized = false;
let currentTrackKey: string | null = null;
let suppressStateUntil = 0;

const emitStateUpdate = (update: PlaybackStateUpdate): void => {
    for (const handler of stateHandlers) {
        handler(update);
    }
};

const ensureSubscription = (): void => {
    if (subscriptionInitialized) {
        return;
    }

    subscriptionInitialized = true;
    spotifyWebPlayerState$.lastState.onChange(({ value }) => {
        if (!value || !currentTrackKey) {
            return;
        }

        const state = value as SpotifyPlaybackState;
        const stateTimestamp = typeof state.timestamp === "number" ? state.timestamp : Date.now();
        if (stateTimestamp < suppressStateUntil) {
            return;
        }

        const stateTrackKey = getSpotifyStateTrackKey(state);
        if (stateTrackKey && stateTrackKey !== currentTrackKey) {
            return;
        }

        const update: PlaybackStateUpdate = {};
        if (typeof state.duration === "number") {
            update.durationSeconds = state.duration / 1000;
        }
        if (typeof state.paused === "boolean") {
            update.isPlaying = !state.paused;
        }
        if (stateTrackKey && typeof state.position === "number") {
            update.positionSeconds = state.position / 1000;
        }

        const artwork = getSpotifyStateArtwork(state);
        if (artwork && stateTrackKey) {
            update.artwork = artwork;
        }

        if (Object.keys(update).length > 0) {
            emitStateUpdate(update);
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

export const spotifyPlaybackProvider: PlaybackProvider = {
    id: "spotify",
    canHandle: (track) => track.provider === "spotify",
    startsPlaybackOnLoad: true,
    onStateChange: (handler) => {
        stateHandlers.add(handler);
        ensureSubscription();
        return () => {
            stateHandlers.delete(handler);
        };
    },
    async load(track, options) {
        activateSpotifyWebPlayer();
        const uri = track.uri || track.id;
        if (!uri) {
            throw new Error("Missing Spotify URI");
        }

        currentTrackKey = getSpotifyTrackKey(track);

        await transferSpotifyPlayback();
        const startPositionSeconds =
            typeof options?.startPositionSeconds === "number" && Number.isFinite(options.startPositionSeconds)
                ? Math.max(0, options.startPositionSeconds)
                : 0;
        const positionMs = Math.round(startPositionSeconds * 1000);
        await playSpotifyUri({ uri, positionMs });

        emitStateUpdate({
            durationSeconds: getDurationSeconds(track),
            isLoading: false,
            isPlaying: true,
        });
    },
    async play() {
        activateSpotifyWebPlayer();
        await resumeSpotify();
        emitStateUpdate({ isPlaying: true });
    },
    async pause() {
        await pauseSpotify();
        emitStateUpdate({ isPlaying: false });
    },
    async seek(positionSeconds) {
        const positionMs = Math.round(Math.max(0, positionSeconds) * 1000);
        suppressStateUntil = Date.now() + 300;
        await seekSpotify(positionMs);
        emitStateUpdate({ positionSeconds: Math.max(0, positionSeconds) });
    },
    async setVolume(volume) {
        await setSpotifyVolume(volume);
    },
    getDurationSeconds,
};
