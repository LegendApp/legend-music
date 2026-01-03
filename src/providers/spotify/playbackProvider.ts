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
const COMPLETION_THRESHOLD_MS = 1500;
const FORCE_START_WINDOW_MS = 5000;
const FORCE_START_THRESHOLD_MS = 2000;
const MAX_FORCE_START_ATTEMPTS = 2;

type SpotifyStateSnapshot = {
    trackKey: string | null;
    positionMs?: number;
    durationMs?: number;
    paused?: boolean;
    timestampMs?: number;
};

let lastStateSnapshot: SpotifyStateSnapshot | null = null;
let completedTrackKey: string | null = null;
let forceStartTrackKey: string | null = null;
let forceStartUntil = 0;
let forceStartAttempts = 0;

const isNearTrackEnd = (positionMs?: number, durationMs?: number): boolean => {
    if (typeof positionMs !== "number" || typeof durationMs !== "number" || durationMs <= 0) {
        return false;
    }
    return positionMs >= Math.max(0, durationMs - COMPLETION_THRESHOLD_MS);
};

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

        const resolvedTrackKey = stateTrackKey ?? currentTrackKey;
        const snapshotMatches = lastStateSnapshot?.trackKey === resolvedTrackKey;
        const lastPositionMs = snapshotMatches ? lastStateSnapshot?.positionMs : undefined;
        const lastDurationMs = snapshotMatches ? lastStateSnapshot?.durationMs : undefined;
        const lastPaused = snapshotMatches ? lastStateSnapshot?.paused : undefined;
        const lastTimestampMs = snapshotMatches ? lastStateSnapshot?.timestampMs : undefined;
        const wasPlaying = lastPaused === false;
        const durationMs = typeof state.duration === "number" ? state.duration : lastDurationMs;
        const positionMs = typeof state.position === "number" ? state.position : lastPositionMs;
        if (
            completedTrackKey === resolvedTrackKey &&
            state.paused === false &&
            typeof positionMs === "number" &&
            positionMs < COMPLETION_THRESHOLD_MS
        ) {
            completedTrackKey = null;
        }
        const wasNearEnd = snapshotMatches ? isNearTrackEnd(lastPositionMs, lastDurationMs) : false;
        const isNearEnd = isNearTrackEnd(positionMs, durationMs);
        const elapsedMs =
            wasPlaying && typeof lastTimestampMs === "number" ? Math.max(0, stateTimestamp - lastTimestampMs) : 0;
        const projectedPositionMs =
            wasPlaying && typeof lastPositionMs === "number" ? lastPositionMs + elapsedMs : undefined;
        const projectedNearEnd = isNearTrackEnd(projectedPositionMs, durationMs);
        const shouldMarkComplete =
            resolvedTrackKey &&
            completedTrackKey !== resolvedTrackKey &&
            state.paused === true &&
            wasPlaying &&
            (isNearEnd || wasNearEnd || projectedNearEnd);

        const update: PlaybackStateUpdate = {};
        let forcedStartPosition = false;

        if (forceStartTrackKey && resolvedTrackKey === forceStartTrackKey) {
            if (Date.now() > forceStartUntil) {
                forceStartTrackKey = null;
            } else if (typeof state.position === "number") {
                if (state.position <= FORCE_START_THRESHOLD_MS) {
                    forceStartTrackKey = null;
                } else if (forceStartAttempts < MAX_FORCE_START_ATTEMPTS) {
                    forceStartAttempts += 1;
                    suppressStateUntil = Date.now() + 500;
                    void seekSpotify(0).catch((error) =>
                        console.error("Failed to force Spotify start position", error),
                    );
                    update.positionSeconds = 0;
                    forcedStartPosition = true;
                }
            }
        }

        if (typeof state.duration === "number") {
            update.durationSeconds = state.duration / 1000;
        }
        if (typeof state.paused === "boolean") {
            update.isPlaying = !state.paused;
        }
        if (!forcedStartPosition && stateTrackKey && typeof state.position === "number") {
            update.positionSeconds = state.position / 1000;
        }

        const artwork = getSpotifyStateArtwork(state);
        if (artwork && stateTrackKey) {
            update.artwork = artwork;
        }

        if (shouldMarkComplete) {
            completedTrackKey = resolvedTrackKey;
            update.didComplete = true;
        }

        lastStateSnapshot = {
            trackKey: resolvedTrackKey,
            positionMs: typeof state.position === "number" ? state.position : lastPositionMs,
            durationMs: typeof state.duration === "number" ? state.duration : lastDurationMs,
            paused: typeof state.paused === "boolean" ? state.paused : lastPaused,
            timestampMs: stateTimestamp,
        };

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
        lastStateSnapshot = null;
        completedTrackKey = null;
        forceStartTrackKey = null;
        forceStartUntil = 0;
        forceStartAttempts = 0;

        await transferSpotifyPlayback();
        const startPositionSeconds =
            typeof options?.startPositionSeconds === "number" && Number.isFinite(options.startPositionSeconds)
                ? Math.max(0, options.startPositionSeconds)
                : 0;
        const positionMs = Math.round(startPositionSeconds * 1000);
        await playSpotifyUri({ uri, positionMs });

        if (startPositionSeconds <= 0) {
            forceStartTrackKey = currentTrackKey;
            forceStartUntil = Date.now() + FORCE_START_WINDOW_MS;
            forceStartAttempts = 0;
        } else {
            forceStartTrackKey = null;
        }

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
    async stop() {
        const deviceId = spotifyWebPlayerState$.deviceId.peek();
        if (!deviceId) {
            return;
        }
        await pauseSpotify(deviceId);
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
