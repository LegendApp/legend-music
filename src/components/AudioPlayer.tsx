import { observable } from "@legendapp/state";
import { showToast } from "@/components/Toast";
import { localPlaybackProvider, LocalTrackNotFoundError } from "@/providers/local/playbackProvider";
import { spotifyPlaybackProvider } from "@/providers/spotify/playbackProvider";
import { getPlaybackProviderForTrack, registerPlaybackProvider, type PlaybackStateUpdate } from "@/providers/types";
import appExit from "@/native-modules/AppExit";
import { appState$ } from "@/observables/appState";
import { DEBUG_AUDIO_LOGS } from "@/systems/constants";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { playbackInteractionState$ } from "@/systems/PlaybackInteractionState";
import { type RepeatMode, settings$ } from "@/systems/Settings";
import { stateSaved$ } from "@/systems/State";
import { getPersistPlugin } from "@/utils/JSONManager";
import { parseDurationToSeconds } from "@/utils/m3u";
import { clearQueueM3U, loadQueueFromM3U, saveQueueToM3U } from "@/utils/m3uManager";
import { perfCount, perfLog, perfMark } from "@/utils/perfLogger";
import { runAfterInteractionsWithLabel } from "@/utils/runAfterInteractions";

export interface AudioPlayerState {
    isPlaying: boolean;
    currentTrack: LocalTrack | null;
    currentTime: number;
    duration: number;
    volume: number;
    isLoading: boolean;
    error: string | null;
    currentIndex: number;
}

// Create observable player state for playback
export const audioPlayerState$ = observable<AudioPlayerState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: 0,
    duration: 0,
    volume: 0.5,
    isLoading: true,
    error: null,
    currentIndex: -1,
});

registerPlaybackProvider(localPlaybackProvider);
registerPlaybackProvider(spotifyPlaybackProvider);

export interface QueuedTrack extends LocalTrack {
    queueEntryId: string;
    isMissing?: boolean;
}

export interface PlaybackQueueState {
    tracks: QueuedTrack[];
}

export const queue$ = observable<PlaybackQueueState>({
    tracks: [],
});

let queueEntryCounter = 0;
let jsProgressTimer: ReturnType<typeof setTimeout> | null = null;
let lastNativeProgressTime = 0;
let lastNativeProgressTimestamp = 0;
let hasPlaybackProgress = false;
let isWindowOccluded = false;
let latestPlaybackTime = 0;
const stateSavedPersistPlugin = getPersistPlugin(stateSaved$);
let appExitSubscription: { remove: () => void } | null = null;

function createQueueEntryId(seed: string): string {
    queueEntryCounter += 1;
    return `${seed}-${Date.now()}-${queueEntryCounter}`;
}

let pendingInitialTrackRestore: { track: QueuedTrack; playbackTime: number } | null = null;

const playbackHistory: number[] = [];
const MAX_HISTORY_LENGTH = 100;

// Flag to track if queue has been loaded from cache
let queueInitialized = false;

interface QueueUpdateOptions {
    playImmediately?: boolean;
    startIndex?: number;
}

interface LoadTrackOptions {
    startPositionSeconds?: number;
}

const getDurationSeconds = (track: LocalTrack): number => {
    if (typeof track.durationMs === "number") {
        return track.durationMs / 1000;
    }
    const parsed = parseDurationToSeconds(track.duration);
    return Number.isFinite(parsed) ? parsed : 0;
};

type QueueInput = LocalTrack | LocalTrack[];

let audioPlayerInitialized = false;

function stopJsProgressTimer(): void {
    if (jsProgressTimer) {
        clearTimeout(jsProgressTimer);
        jsProgressTimer = null;
    }
    lastNativeProgressTimestamp = 0;
}

function anchorProgress(time: number): void {
    lastNativeProgressTime = time;
    lastNativeProgressTimestamp = Date.now();
}

function setProgressAnchor(time: number): void {
    hasPlaybackProgress = true;
    anchorProgress(time);
}

function resetProgressState(): void {
    stopJsProgressTimer();
    hasPlaybackProgress = false;
    lastNativeProgressTime = 0;
    lastNativeProgressTimestamp = 0;
}

function getMsUntilNextProgressSecond(): number {
    if (!lastNativeProgressTimestamp) {
        return 0;
    }

    const elapsedMs = Date.now() - lastNativeProgressTimestamp;
    const msIntoSecond = elapsedMs % 1000;

    // When we're exactly on the boundary, fire immediately, otherwise wait until the next second boundary
    return msIntoSecond === 0 ? 0 : 1000 - msIntoSecond;
}

function scheduleJsProgressTick(): void {
    const delay = getMsUntilNextProgressSecond();
    jsProgressTimer = setTimeout(tickJsProgress, delay);
}

function tickJsProgress(): void {
    if (isWindowOccluded || !audioPlayerState$.isPlaying.peek()) {
        stopJsProgressTimer();
        return;
    }

    if (!lastNativeProgressTimestamp) {
        return;
    }

    const elapsedSeconds = (Date.now() - lastNativeProgressTimestamp) / 1000;
    const duration = audioPlayerState$.duration.peek();
    const projected = lastNativeProgressTime + elapsedSeconds;
    const target = duration > 0 ? Math.min(duration, projected) : projected;
    const current = audioPlayerState$.currentTime.peek();

    if (!playbackInteractionState$.isScrubbing.peek() && Math.abs(target - current) >= 0.05) {
        audioPlayerState$.currentTime.set(target);
    }

    // Schedule next tick aligned to second boundaries from the last native progress anchor
    scheduleJsProgressTick();
}

function startJsProgressTimer(): void {
    if (!hasPlaybackProgress || jsProgressTimer || !lastNativeProgressTimestamp) {
        return;
    }

    // Schedule first tick aligned to the last native progress timestamp
    scheduleJsProgressTick();
}

function applyWindowOcclusionState(isOccluded: boolean): void {
    if (isWindowOccluded === isOccluded) {
        return;
    }

    isWindowOccluded = isOccluded;
    if (isOccluded) {
        stopJsProgressTimer();
    }
}

function applyPlaybackStateUpdate(update: PlaybackStateUpdate): void {
    if (typeof update.isOccluded === "boolean") {
        applyWindowOcclusionState(update.isOccluded);
    }

    if (typeof update.isLoading === "boolean") {
        audioPlayerState$.isLoading.set(update.isLoading);
    }

    if (update.error !== undefined) {
        audioPlayerState$.error.set(update.error ?? null);
        if (update.error) {
            audioPlayerState$.isPlaying.set(false);
        }
    }

    if (typeof update.durationSeconds === "number" && update.durationSeconds > 0) {
        if (update.durationSeconds !== audioPlayerState$.duration.peek()) {
            audioPlayerState$.duration.set(update.durationSeconds);
        }
    }

    if (typeof update.positionSeconds === "number") {
        setProgressAnchor(update.positionSeconds);
        if (!isWindowOccluded && !playbackInteractionState$.isScrubbing.peek()) {
            audioPlayerState$.currentTime.set(update.positionSeconds);
        }
        if (audioPlayerState$.isPlaying.peek() && !isWindowOccluded) {
            startJsProgressTimer();
        }
    }

    if (typeof update.isPlaying === "boolean") {
        audioPlayerState$.isPlaying.set(update.isPlaying);
        if (update.isPlaying && !isWindowOccluded) {
            if (!hasPlaybackProgress) {
                setProgressAnchor(audioPlayerState$.currentTime.peek());
            } else {
                anchorProgress(audioPlayerState$.currentTime.peek());
            }
            startJsProgressTimer();
        } else {
            stopJsProgressTimer();
        }
    }

    if (update.artwork) {
        const current = audioPlayerState$.currentTrack.peek();
        const currentQueueEntryId = (current as Partial<QueuedTrack> | null)?.queueEntryId;
        if (current && !current.thumbnail && currentQueueEntryId) {
            updateQueueEntry(currentQueueEntryId, { thumbnail: update.artwork });
            audioPlayerState$.currentTrack.set({ ...current, thumbnail: update.artwork });
        }
    }

    if (update.didComplete) {
        const duration = audioPlayerState$.duration.peek();
        audioPlayerState$.currentTime.set(duration);
        audioPlayerState$.isPlaying.set(false);
        stopJsProgressTimer();
        audioControls.playNext();
    }

    if (update.command) {
        switch (update.command) {
            case "play":
                void play();
                break;
            case "pause":
                void pause();
                break;
            case "toggle":
                void togglePlayPause();
                break;
            case "next":
                void playNext();
                break;
            case "previous":
                void playPrevious();
                break;
            default:
                break;
        }
    }
}

function createQueuedTrack(track: LocalTrack): QueuedTrack {
    return {
        ...track,
        queueEntryId: createQueueEntryId(track.id),
    };
}

function isQueuedTrack(track: LocalTrack): track is QueuedTrack {
    return typeof (track as Partial<QueuedTrack>).queueEntryId === "string";
}

function updateQueueEntry(queueEntryId: string, updates: Partial<QueuedTrack>): void {
    const tracks = getQueueSnapshot();
    const index = tracks.findIndex((queued) => queued.queueEntryId === queueEntryId);
    if (index === -1) {
        return;
    }

    const nextQueue = [...tracks];
    nextQueue[index] = { ...nextQueue[index], ...updates };
    setQueueTracks(nextQueue);
}

function persistPlaybackIndex(index: number): void {
    const queueLength = queue$.tracks.peek().length;
    const clampedIndex = queueLength ? clampIndex(index, queueLength) : -1;
    stateSaved$.playbackIndex.set(clampedIndex);
    if (clampedIndex === -1) {
        stateSaved$.playbackTime.set(0);
    }
}

async function persistPlaybackTimeNow(): Promise<void> {
    const timeToPersist = Math.max(0, latestPlaybackTime);
    try {
        stateSaved$.playbackTime.set(timeToPersist);
        console.log("persistPlaybackTimeNow", timeToPersist);
        await stateSavedPersistPlugin?.flush();
    } catch (error) {
        console.error("Failed to flush playback time", error);
    }
}

function resetSavedPlaybackState(): void {
    latestPlaybackTime = 0;
    stateSaved$.assign({ playbackIndex: -1, playbackTime: 0 });
}

function applyDurationFromTrack(track: LocalTrack): void {
    const provider = getPlaybackProviderForTrack(track);
    const seconds = provider ? provider.getDurationSeconds(track) : getDurationSeconds(track);
    if (seconds > 0) {
        audioPlayerState$.duration.set(seconds);
    }
}

async function hydrateCurrentTrackMetadata(track: QueuedTrack): Promise<void> {
    const provider = getPlaybackProviderForTrack(track);
    const updates = provider?.hydrateTrackMetadata ? await provider.hydrateTrackMetadata(track) : null;

    if (updates && track.queueEntryId) {
        updateQueueEntry(track.queueEntryId, updates);
    }

    const current = audioPlayerState$.currentTrack.peek();
    if (updates && current && current.queueEntryId === track.queueEntryId) {
        audioPlayerState$.currentTrack.set({ ...current, ...updates });
    }

    applyDurationFromTrack(track);
}

const handleMissingTrackFile = (track: LocalTrack, queueEntryId?: string) => {
    const label = track.title || track.fileName || track.filePath;
    showToast(`Track not found: ${label}`, "error");
    if (queueEntryId) {
        updateQueueEntry(queueEntryId, { isMissing: true });
    }
    audioPlayerState$.error.set("Track file not found");
    audioPlayerState$.isLoading.set(false);
    audioPlayerState$.isPlaying.set(false);
};

const handleTrackLoadFailure = (_track: LocalTrack, _queueEntryId: string | undefined, errorMessage: string) => {
    audioPlayerState$.error.set(errorMessage);
    audioPlayerState$.isLoading.set(false);
    audioPlayerState$.isPlaying.set(false);
};

function asArray(input: QueueInput): LocalTrack[] {
    return Array.isArray(input) ? input : [input];
}

function clampIndex(index: number, length: number): number {
    if (length === 0) {
        return -1;
    }
    return Math.max(0, Math.min(index, length - 1));
}

function getQueueSnapshot(): QueuedTrack[] {
    return queue$.tracks.peek();
}

function setQueueTracks(tracks: QueuedTrack[], options: { skipPersistence?: boolean } = {}): void {
    queue$.tracks.set(tracks);
    if (!options.skipPersistence) {
        persistPlaybackIndex(audioPlayerState$.currentIndex.peek());
    }

    // Save to M3U file when queue changes (but not during initial load)
    if (queueInitialized) {
        saveQueueToM3U(tracks);
    }
}

function pushHistory(index: number): void {
    if (index < 0) {
        return;
    }
    playbackHistory.push(index);
    if (playbackHistory.length > MAX_HISTORY_LENGTH) {
        playbackHistory.shift();
    }
}

function popHistory(): number | undefined {
    return playbackHistory.pop();
}

function clearHistory(): void {
    playbackHistory.length = 0;
}

function getPlaybackSettings() {
    const playbackSettings = settings$.playback.get();
    return {
        shuffle: playbackSettings.shuffle,
        repeatMode: playbackSettings.repeatMode,
    };
}

audioPlayerState$.currentIndex.onChange(({ value }) => {
    persistPlaybackIndex(typeof value === "number" ? value : -1);
});

audioPlayerState$.currentTime.onChange(({ value }) => {
    latestPlaybackTime = Math.max(0, typeof value === "number" ? value : 0);
});

audioPlayerState$.isPlaying.onChange(({ value }) => {
    if (!value) {
        latestPlaybackTime = Math.max(0, audioPlayerState$.currentTime.peek());
    }
});

function initializeAppExitHandler(): void {
    if (appExitSubscription) {
        return;
    }

    appExitSubscription = appExit.addListener("onAppExit", () => {
        persistPlaybackTimeNow()
            .catch((error) => {
                console.error("Failed to persist playback time on exit", error);
            })
            .finally(() => {
                appExit.completeExit(true);
            });
    });
}

function resetPlayerForEmptyQueue(): void {
    const currentTrack = audioPlayerState$.currentTrack.peek();
    const currentProvider = currentTrack ? getPlaybackProviderForTrack(currentTrack) : null;
    resetSavedPlaybackState();
    resetProgressState();
    audioPlayerState$.currentTrack.set(null);
    audioPlayerState$.currentIndex.set(-1);
    audioPlayerState$.currentTime.set(0);
    audioPlayerState$.duration.set(0);
    audioPlayerState$.isPlaying.set(false);
    pendingInitialTrackRestore = null;
    currentProvider?.stop?.().catch((error) => console.error("Error stopping playback:", error));
    currentProvider?.clearNowPlayingInfo?.();
}

async function play(): Promise<void> {
    perfLog("LocalAudioControls.play");
    const currentTrack = audioPlayerState$.currentTrack.peek();
    const provider = currentTrack ? getPlaybackProviderForTrack(currentTrack) : null;
    if (!provider) {
        return;
    }

    try {
        if (provider.id === "local") {
            const duration = audioPlayerState$.duration.peek();
            const currentTime = audioPlayerState$.currentTime.peek();
            const shouldRestart = duration > 0 && duration - currentTime <= 2;

            if (shouldRestart) {
                audioPlayerState$.currentTime.set(0);
                try {
                    await provider.seek(0);
                } catch (seekError) {
                    console.error("Error seeking to restart playback:", seekError);
                }
            }
        }

        await provider.play();
    } catch (error) {
        console.error("Error playing:", error);
        if (provider.id === "spotify") {
            showToast(error instanceof Error ? error.message : "Spotify playback failed", "error");
        }
        audioPlayerState$.error.set(error instanceof Error ? error.message : "Play failed");
    }
}

async function pause(): Promise<void> {
    perfLog("LocalAudioControls.pause");
    const currentTrack = audioPlayerState$.currentTrack.peek();
    const provider = currentTrack ? getPlaybackProviderForTrack(currentTrack) : null;
    if (!provider) {
        return;
    }

    try {
        await provider.pause();
    } catch (error) {
        console.error("Error pausing:", error);
    }

    stopJsProgressTimer();
}

async function loadTrackInternal(track: LocalTrack, options: LoadTrackOptions = {}): Promise<boolean> {
    perfLog("LocalAudioControls.loadTrack", { id: track.id, filePath: track.filePath });
    if (__DEV__) {
        if (DEBUG_AUDIO_LOGS) {
            console.log("Loading track:", track.title, "by", track.artist);
        }
    }

    const previousTrack = audioPlayerState$.currentTrack.peek();
    const previousProvider = previousTrack ? getPlaybackProviderForTrack(previousTrack) : null;
    const nextProvider = getPlaybackProviderForTrack(track);
    if (previousProvider && nextProvider && previousProvider.id !== nextProvider.id) {
        try {
            await previousProvider.stop?.();
        } catch (error) {
            console.error("Error stopping previous playback:", error);
        }
        previousProvider.clearNowPlayingInfo?.();
    }

    pendingInitialTrackRestore = null;
    resetProgressState();
    audioPlayerState$.currentTrack.set(track);
    audioPlayerState$.currentTime.set(0);
    audioPlayerState$.duration.set(0);
    audioPlayerState$.isLoading.set(true);
    audioPlayerState$.error.set(null);
    const queueEntryId = isQueuedTrack(track) ? track.queueEntryId : undefined;

    if (!nextProvider) {
        handleTrackLoadFailure(track, queueEntryId, "Unsupported playback provider");
        return false;
    }

    try {
        await nextProvider.load(track, options);
        perfLog("LocalAudioControls.loadTrack.success", { filePath: track.filePath });
        if (queueEntryId) {
            void hydrateCurrentTrackMetadata(track as QueuedTrack);
        }
        if (nextProvider.id === "spotify") {
            if (audioPlayerState$.duration.peek() <= 0) {
                applyDurationFromTrack(track);
            }
            if (!audioPlayerState$.isPlaying.peek()) {
                audioPlayerState$.isPlaying.set(true);
                setProgressAnchor(audioPlayerState$.currentTime.peek());
                if (!isWindowOccluded) {
                    startJsProgressTimer();
                }
            }
        }
    } catch (error) {
        if (error instanceof LocalTrackNotFoundError) {
            handleMissingTrackFile(track, queueEntryId);
            return false;
        }
        const errorMessage = error instanceof Error ? error.message : "Failed to load track";
        perfLog("LocalAudioControls.loadTrack.error", errorMessage);
        if (nextProvider.id === "spotify") {
            showToast(errorMessage, "error");
        }
        handleTrackLoadFailure(track, queueEntryId, errorMessage);
        return false;
    }

    return !nextProvider.startsPlaybackOnLoad;
}

interface PlayTrackFromQueueOptions extends QueueUpdateOptions {
    recordHistory?: boolean;
}

function playTrackFromQueue(index: number, options: PlayTrackFromQueueOptions = {}): void {
    const tracks = getQueueSnapshot();
    const targetIndex = clampIndex(options.startIndex ?? index, tracks.length);

    if (tracks.length === 0 || targetIndex === -1) {
        resetPlayerForEmptyQueue();
        return;
    }

    const currentIndex = audioPlayerState$.currentIndex.peek();
    if (options.recordHistory && currentIndex !== -1 && currentIndex !== targetIndex) {
        pushHistory(currentIndex);
    }

    const track = tracks[targetIndex];
    audioPlayerState$.currentIndex.set(targetIndex);
    void loadTrackInternal(track).then((shouldPlayLocal) => {
        if (shouldPlayLocal && (options.playImmediately ?? true)) {
            void play();
        }
    });
}

function queueReplace(tracksInput: LocalTrack[], options: QueueUpdateOptions = {}): void {
    perfLog("Queue.replace", { length: tracksInput.length, startIndex: options.startIndex });
    const tracks = tracksInput.map(createQueuedTrack);
    clearHistory();
    setQueueTracks(tracks);

    if (tracks.length === 0) {
        resetPlayerForEmptyQueue();
        return;
    }

    const startIndex = clampIndex(options.startIndex ?? 0, tracks.length);
    playTrackFromQueue(startIndex, {
        playImmediately: options.playImmediately ?? true,
        startIndex,
    });
}

function queueAppend(input: QueueInput, options: QueueUpdateOptions = {}): void {
    const additions = asArray(input);
    const existing = getQueueSnapshot();
    const wasEmpty = existing.length === 0;
    const queuedAdditions = additions.map(createQueuedTrack);
    const nextQueue = [...existing, ...queuedAdditions];

    perfLog("Queue.append", { additions: additions.length, wasEmpty });
    setQueueTracks(nextQueue);

    if (wasEmpty) {
        clearHistory();
        playTrackFromQueue(0, {
            playImmediately: options.playImmediately ?? true,
            startIndex: 0,
        });
        return;
    }

    if (options.playImmediately) {
        const targetIndex = nextQueue.length - queuedAdditions.length;
        playTrackFromQueue(targetIndex, { playImmediately: true, startIndex: targetIndex });
    }
}

function queueInsertNext(input: QueueInput, options: QueueUpdateOptions = {}): void {
    const additions = asArray(input);
    const existing = getQueueSnapshot();

    if (existing.length === 0) {
        queueReplace(additions, options);
        return;
    }

    const currentIndex = audioPlayerState$.currentIndex.peek();
    const insertPosition = currentIndex >= 0 ? Math.min(currentIndex + 1, existing.length) : existing.length;
    const queuedAdditions = additions.map(createQueuedTrack);
    const nextQueue = [...existing.slice(0, insertPosition), ...queuedAdditions, ...existing.slice(insertPosition)];

    perfLog("Queue.insertNext", { additions: additions.length, insertPosition, currentIndex });
    setQueueTracks(nextQueue);

    if (currentIndex === -1) {
        playTrackFromQueue(0, {
            playImmediately: options.playImmediately ?? true,
            startIndex: 0,
        });
    } else if (options.playImmediately) {
        playTrackFromQueue(insertPosition, { playImmediately: true, startIndex: insertPosition });
    }
}

function queueInsertAt(position: number, input: QueueInput, options: QueueUpdateOptions = {}): void {
    const additions = asArray(input);
    const existing = getQueueSnapshot();

    if (existing.length === 0) {
        queueReplace(additions, options);
        return;
    }

    const boundedPosition = Math.max(0, Math.min(position, existing.length));
    const queuedAdditions = additions.map(createQueuedTrack);
    const nextQueue = [...existing.slice(0, boundedPosition), ...queuedAdditions, ...existing.slice(boundedPosition)];

    perfLog("Queue.insertAt", { additions: additions.length, position: boundedPosition });
    setQueueTracks(nextQueue);

    const currentIndex = audioPlayerState$.currentIndex.peek();
    if (currentIndex === -1) {
        playTrackFromQueue(0, {
            playImmediately: options.playImmediately ?? true,
            startIndex: 0,
        });
        return;
    }

    if (options.playImmediately) {
        playTrackFromQueue(boundedPosition, { playImmediately: true, startIndex: boundedPosition });
        return;
    }

    if (currentIndex >= boundedPosition) {
        audioPlayerState$.currentIndex.set(currentIndex + queuedAdditions.length);
    }
}

function queueReorder(fromIndex: number, toIndex: number): void {
    const tracks = getQueueSnapshot();
    const length = tracks.length;

    if (length === 0) {
        return;
    }

    const from = clampIndex(fromIndex, length);
    if (from === -1 || from >= length) {
        return;
    }

    const boundedTarget = Math.max(0, Math.min(toIndex, length));

    if (from === boundedTarget || (from < boundedTarget && from + 1 === boundedTarget)) {
        return;
    }

    const nextQueue = [...tracks];
    const [moved] = nextQueue.splice(from, 1);

    if (!moved) {
        return;
    }

    let insertIndex = boundedTarget;
    if (from < boundedTarget) {
        insertIndex = Math.max(0, boundedTarget - 1);
    }
    insertIndex = Math.max(0, Math.min(insertIndex, nextQueue.length));

    perfLog("Queue.reorder", { fromIndex: from, toIndex: boundedTarget, insertIndex });

    nextQueue.splice(insertIndex, 0, moved);
    setQueueTracks(nextQueue);

    const currentIndex = audioPlayerState$.currentIndex.peek();
    if (currentIndex === -1) {
        return;
    }

    const currentTrack = tracks[currentIndex];
    if (!currentTrack) {
        audioPlayerState$.currentIndex.set(Math.min(currentIndex, nextQueue.length - 1));
        return;
    }

    const nextCurrentIndex = nextQueue.findIndex((track) => track.queueEntryId === currentTrack.queueEntryId);
    if (nextCurrentIndex !== -1) {
        audioPlayerState$.currentIndex.set(nextCurrentIndex);
    } else {
        audioPlayerState$.currentIndex.set(Math.min(currentIndex, nextQueue.length - 1));
    }
}

function queueRemoveIndices(indices: number[]): void {
    if (indices.length === 0) {
        return;
    }

    const existing = getQueueSnapshot();
    if (existing.length === 0) {
        return;
    }

    const uniqueSorted = Array.from(new Set(indices))
        .filter((index) => index >= 0 && index < existing.length)
        .sort((a, b) => a - b);

    if (uniqueSorted.length === 0) {
        return;
    }

    const removalSet = new Set(uniqueSorted);
    const nextQueue = existing.filter((_, index) => !removalSet.has(index));

    perfLog("Queue.removeIndices", { count: uniqueSorted.length });
    clearHistory();
    setQueueTracks(nextQueue);

    if (nextQueue.length === 0) {
        resetPlayerForEmptyQueue();
        return;
    }

    const currentIndex = audioPlayerState$.currentIndex.peek();
    if (currentIndex === -1) {
        return;
    }

    const removedBeforeCurrent = uniqueSorted.filter((index) => index < currentIndex).length;

    if (removalSet.has(currentIndex)) {
        const isPlaying = audioPlayerState$.isPlaying.peek();
        const nextIndex = Math.min(currentIndex - removedBeforeCurrent, nextQueue.length - 1);

        if (nextIndex >= 0) {
            playTrackFromQueue(nextIndex, { playImmediately: isPlaying, startIndex: nextIndex });
        } else {
            resetPlayerForEmptyQueue();
        }
        return;
    }

    const nextIndex = Math.max(0, currentIndex - removedBeforeCurrent);
    audioPlayerState$.currentIndex.set(nextIndex);
}

function queueClear(): void {
    perfLog("Queue.clear");
    clearHistory();
    setQueueTracks([]);
    resetPlayerForEmptyQueue();

    // Clear the M3U file as well
    if (queueInitialized) {
        void clearQueueM3U();
    }
}
function initializeQueueFromCache(): void {
    if (queueInitialized) {
        return;
    }

    const savedPlaybackState = stateSaved$.get();
    const savedPlaybackIndex =
        savedPlaybackState?.playbackIndex != null ? Number(savedPlaybackState.playbackIndex) : -1;
    const savedPlaybackTime = savedPlaybackState?.playbackTime != null ? Number(savedPlaybackState.playbackTime) : 0;
    const start = perfMark("Queue.initializeQueueFromCache.start");
    try {
        const savedTracks = loadQueueFromM3U();

        if (savedTracks.length > 0) {
            // Convert to queued tracks without triggering save
            clearHistory();
            const queuedTracks = savedTracks.map(createQueuedTrack);
            setQueueTracks(queuedTracks, { skipPersistence: true });

            const resolvedIndex =
                savedPlaybackIndex >= 0 && savedPlaybackIndex < queuedTracks.length ? savedPlaybackIndex : -1;

            if (resolvedIndex >= 0) {
                const currentTrack = queuedTracks[resolvedIndex];
                audioPlayerState$.currentTrack.set(currentTrack);
                audioPlayerState$.currentIndex.set(resolvedIndex);
                applyDurationFromTrack(currentTrack);
                if (savedPlaybackTime > 0) {
                    audioPlayerState$.currentTime.set(
                        Math.min(savedPlaybackTime, parseDurationToSeconds(currentTrack.duration)),
                    );
                }
                pendingInitialTrackRestore = {
                    track: currentTrack,
                    playbackTime: savedPlaybackTime > 0 ? savedPlaybackTime : 0,
                };
                void hydrateCurrentTrackMetadata(currentTrack);
            } else {
                audioPlayerState$.currentTrack.set(null);
                audioPlayerState$.currentIndex.set(-1);
                pendingInitialTrackRestore = null;
            }

            if (DEBUG_AUDIO_LOGS) {
                console.log(`Restored queue with ${queuedTracks.length} tracks from cache`);
            }
            persistPlaybackIndex(resolvedIndex);
            if (savedPlaybackTime > 0) {
                stateSaved$.playbackTime.set(savedPlaybackTime);
            }
        } else {
            resetSavedPlaybackState();
        }
    } catch (error) {
        console.error("Failed to initialize queue from cache:", error);
    } finally {
        const durationMs = typeof start === "number" ? Date.now() - start : undefined;
        if (durationMs !== undefined) {
            perfMark("Queue.initializeQueueFromCache.end", { durationMs });
        }
        queueInitialized = true;
        audioPlayerState$.isLoading.set(false);
    }
}

// Initialize queue from cache on first run
initializeQueueFromCache();
initializeAppExitHandler();

export const queueControls = {
    replace: queueReplace,
    append: queueAppend,
    insertNext: queueInsertNext,
    insertAt: queueInsertAt,
    reorder: queueReorder,
    remove: queueRemoveIndices,
    clear: queueClear,
};

async function loadTrack(track: LocalTrack, options?: QueueUpdateOptions): Promise<void>;
async function loadTrack(filePath: string, title: string, artist: string): Promise<void>;
async function loadTrack(arg1: LocalTrack | string, arg2?: QueueUpdateOptions | string, arg3?: string): Promise<void> {
    if (typeof arg1 === "string") {
        const track: LocalTrack = {
            id: arg1,
            filePath: arg1,
            title: typeof arg2 === "string" ? arg2 : arg1,
            artist: typeof arg3 === "string" ? arg3 : "Unknown Artist",
            duration: " ",
            fileName: typeof arg2 === "string" ? arg2 : arg1,
        };

        await loadTrackInternal(track);
        await play();
        return;
    }

    const options = (arg2 as QueueUpdateOptions | undefined) ?? {};
    audioPlayerState$.currentIndex.set(-1);
    await loadTrackInternal(arg1);
    if (options.playImmediately ?? true) {
        await play();
    }
}

function loadPlaylist(playlist: LocalTrack[], startIndex = 0, options: QueueUpdateOptions = {}): void {
    queueReplace(playlist, { startIndex, playImmediately: options.playImmediately ?? true });
}

async function togglePlayPause(): Promise<void> {
    perfLog("LocalAudioControls.togglePlayPause", { isPlaying: audioPlayerState$.isPlaying.get() });
    if (audioPlayerState$.currentTrack.get()) {
        const isPlaying = audioPlayerState$.isPlaying.get();
        if (isPlaying) {
            await pause();
        } else {
            if (pendingInitialTrackRestore) {
                await restoreTrackFromSnapshotIfNeeded({ force: true, playAfterLoad: true });
                return;
            }
            await play();
        }
    }
}

function toggleShuffle(): void {
    const isShuffleEnabled = settings$.playback.shuffle.get();
    settings$.playback.shuffle.set(!isShuffleEnabled);
}

function cycleRepeatMode(): void {
    const currentMode = settings$.playback.repeatMode.get();
    const order: RepeatMode[] = ["off", "all", "one"];
    const nextIndex = (order.indexOf(currentMode) + 1) % order.length;
    settings$.playback.repeatMode.set(order[nextIndex]);
}

function setRepeatMode(mode: RepeatMode): void {
    settings$.playback.repeatMode.set(mode);
}

function playPrevious(): void {
    const { shuffle, repeatMode } = getPlaybackSettings();
    const currentIndex = audioPlayerState$.currentIndex.peek();
    const tracks = getQueueSnapshot();
    perfLog("LocalAudioControls.playPrevious", { currentIndex, queueLength: tracks.length, shuffle, repeatMode });

    if (tracks.length === 0) {
        return;
    }

    if (repeatMode === "one" && currentIndex >= 0) {
        playTrackFromQueue(currentIndex, {
            playImmediately: true,
            startIndex: currentIndex,
            recordHistory: false,
        });
        return;
    }

    if (shuffle) {
        const previousIndex = popHistory();
        if (previousIndex != null && previousIndex >= 0 && previousIndex < tracks.length) {
            playTrackFromQueue(previousIndex, {
                playImmediately: true,
                startIndex: previousIndex,
                recordHistory: false,
            });
            return;
        }
    }

    if (currentIndex <= 0) {
        if (repeatMode === "all" && tracks.length > 0) {
            const lastIndex = tracks.length - 1;
            playTrackFromQueue(lastIndex, {
                playImmediately: true,
                startIndex: lastIndex,
                recordHistory: true,
            });
        }
        return;
    }

    const newIndex = currentIndex - 1;
    playTrackFromQueue(newIndex, { playImmediately: true, startIndex: newIndex, recordHistory: false });
}

function playNext(): void {
    const { shuffle, repeatMode } = getPlaybackSettings();
    const currentIndex = audioPlayerState$.currentIndex.peek();
    const tracks = getQueueSnapshot();
    perfLog("LocalAudioControls.playNext", { currentIndex, queueLength: tracks.length, shuffle, repeatMode });

    if (tracks.length === 0) {
        return;
    }

    if (repeatMode === "one" && currentIndex >= 0) {
        playTrackFromQueue(currentIndex, {
            playImmediately: true,
            startIndex: currentIndex,
            recordHistory: false,
        });
        return;
    }

    let nextIndex = -1;

    if (shuffle) {
        const available = tracks.map((_, idx) => idx).filter((idx) => idx !== currentIndex);
        if (available.length > 0) {
            const randomIdx = Math.floor(Math.random() * available.length);
            nextIndex = available[randomIdx];
        } else if (repeatMode === "all" && currentIndex >= 0) {
            nextIndex = currentIndex;
        }
    } else if (currentIndex < tracks.length - 1) {
        nextIndex = currentIndex + 1;
    } else if (repeatMode === "all") {
        nextIndex = tracks.length > 0 ? 0 : -1;
    }

    if (nextIndex === -1) {
        const duration = audioPlayerState$.duration.peek();
        audioPlayerState$.currentTime.set(duration);
        audioPlayerState$.isPlaying.set(false);
        return;
    }

    playTrackFromQueue(nextIndex, {
        playImmediately: true,
        startIndex: nextIndex,
        recordHistory: true,
    });
}

function playTrackAtIndex(index: number): void {
    const tracks = getQueueSnapshot();
    perfLog("LocalAudioControls.playTrackAtIndex", { index, queueLength: tracks.length });
    if (tracks.length === 0 || index < 0 || index >= tracks.length) {
        return;
    }

    playTrackFromQueue(index, { playImmediately: true, startIndex: index, recordHistory: true });
}

async function setVolume(volume: number): Promise<void> {
    perfLog("LocalAudioControls.setVolume", { volume });
    const clampedVolume = Math.max(0, Math.min(1, volume));
    audioPlayerState$.volume.set(clampedVolume);
    const currentTrack = audioPlayerState$.currentTrack.peek();
    const provider = currentTrack ? getPlaybackProviderForTrack(currentTrack) : localPlaybackProvider;
    if (!provider) {
        return;
    }

    try {
        await provider.setVolume(clampedVolume);
    } catch (error) {
        console.error("Error setting volume:", error);
    }
}

async function seek(seconds: number): Promise<void> {
    perfLog("LocalAudioControls.seek", { seconds });
    const nextSeconds = Number(seconds);
    if (!Number.isFinite(nextSeconds)) {
        if (__DEV__) {
            console.warn("Invalid seek value", { seconds });
        }
        return;
    }

    const clampedSeconds = Math.max(0, nextSeconds);
    const currentTrack = audioPlayerState$.currentTrack.peek();
    const provider = currentTrack ? getPlaybackProviderForTrack(currentTrack) : null;
    if (!provider) {
        return;
    }

    try {
        if (provider.id === "spotify") {
            setProgressAnchor(clampedSeconds);
            audioPlayerState$.currentTime.set(clampedSeconds);
            if (audioPlayerState$.isPlaying.peek() && !isWindowOccluded) {
                startJsProgressTimer();
            }
        }
        await provider.seek(clampedSeconds);
    } catch (error) {
        console.error("Error seeking:", error);
    }
}

function getCurrentState(): AudioPlayerState {
    return audioPlayerState$.get();
}

async function restoreTrackFromSnapshotIfNeeded({
    force,
    playAfterLoad,
}: {
    force?: boolean;
    playAfterLoad?: boolean;
} = {}): Promise<void> {
    if (!pendingInitialTrackRestore) {
        return;
    }

    const localPlaybackAvailable = localPlaybackProvider.isAvailable
        ? localPlaybackProvider.isAvailable()
        : true;
    const pendingProvider = getPlaybackProviderForTrack(pendingInitialTrackRestore.track);
    if ((!pendingProvider || pendingProvider.id === "local") && !localPlaybackAvailable) {
        return;
    }

    if (!force) {
        return;
    }

    const snapshot = pendingInitialTrackRestore;
    pendingInitialTrackRestore = null;
    const { track, playbackTime } = snapshot;
    const provider = getPlaybackProviderForTrack(track);
    const shouldRestorePosition = playbackTime > 0 && !provider?.startsPlaybackOnLoad;

    runAfterInteractionsWithLabel(() => {
        const start = perfMark("LocalAudioPlayer.restoreTrackFromSnapshot.start", {
            track: track.title,
            filePath: track.filePath,
        });
        void (async () => {
            try {
                await loadTrackInternal(track, {
                    startPositionSeconds: shouldRestorePosition ? playbackTime : undefined,
                });
                if (shouldRestorePosition) {
                    try {
                        await seek(playbackTime);
                        audioPlayerState$.currentTime.set(playbackTime);
                    } catch (seekError) {
                        console.error("Failed to restore playback position", seekError);
                    }
                }
                if (playAfterLoad) {
                    await play();
                }
            } finally {
                if (start !== undefined) {
                    perfMark("LocalAudioPlayer.restoreTrackFromSnapshot.end", {
                        track: track.title,
                        durationMs: Date.now() - start,
                    });
                }
            }
        })();
    }, "LocalAudioPlayer.restoreTrackFromSnapshot");
}

// Expose control methods for playback
export const audioControls = {
    loadTrack,
    loadPlaylist,
    play,
    pause,
    togglePlayPause,
    toggleShuffle,
    cycleRepeatMode,
    setRepeatMode,
    playPrevious,
    playNext,
    playTrackAtIndex,
    setVolume,
    seek,
    getCurrentState,
    queue: queueControls,
};

export function initializeAudioPlayer(): void {
    const localPlaybackAvailable = localPlaybackProvider.isAvailable
        ? localPlaybackProvider.isAvailable()
        : true;
    if (audioPlayerInitialized) {
        return;
    }

    audioPlayerInitialized = true;
    perfCount("LocalAudioPlayer.initialize");
    if (localPlaybackAvailable && localPlaybackProvider.onStateChange) {
        localPlaybackProvider.onStateChange((update) => {
            applyPlaybackStateUpdate(update);
        });
    }
    if (spotifyPlaybackProvider.onStateChange) {
        spotifyPlaybackProvider.onStateChange((update) => {
            applyPlaybackStateUpdate(update);
        });
    }
}
