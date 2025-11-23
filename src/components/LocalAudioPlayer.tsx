import { observable } from "@legendapp/state";
import { useEffect } from "react";
import { View } from "react-native";
import { File } from "expo-file-system/next";
import { showToast } from "@/components/Toast";
import { type NowPlayingInfoPayload, useAudioPlayer } from "@/native-modules/AudioPlayer";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { ensureLocalTrackThumbnail } from "@/systems/LocalMusicState";
import { playbackInteractionState$ } from "@/systems/PlaybackInteractionState";
import type { PersistedQueuedTrack, PlaylistSnapshot } from "@/systems/PlaylistCache";
import { getPlaylistCacheSnapshot, persistPlaylistSnapshot } from "@/systems/PlaylistCache";
import { DEBUG_AUDIO_LOGS } from "@/systems/constants";
import { type RepeatMode, settings$ } from "@/systems/Settings";
import { clearQueueM3U, loadQueueFromM3U, saveQueueToM3U } from "@/utils/m3uManager";
import { perfCount, perfDelta, perfLog } from "@/utils/perfLogger";
import { runAfterInteractions } from "@/utils/runAfterInteractions";
import { resolveThumbnailFromFields } from "@/utils/thumbnails";

export interface LocalPlayerState {
    isPlaying: boolean;
    currentTrack: LocalTrack | null;
    currentTime: number;
    duration: number;
    volume: number;
    isLoading: boolean;
    error: string | null;
    currentIndex: number;
}

// Create observable player state for local music
export const localPlayerState$ = observable<LocalPlayerState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: 0,
    duration: 0,
    volume: 0.5,
    isLoading: true,
    error: null,
    currentIndex: -1,
});

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

function createQueueEntryId(seed: string): string {
    queueEntryCounter += 1;
    return `${seed}-${Date.now()}-${queueEntryCounter}`;
}

const createQueuedTrackFromPersisted = (track: PersistedQueuedTrack): QueuedTrack => {
    const { thumbnail, thumbnailKey } = resolveThumbnailFromFields(track);
    const fileName = track.filePath.split("/").pop() || track.title || track.filePath;
    return {
        id: track.filePath,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        filePath: track.filePath,
        fileName,
        thumbnail,
        thumbnailKey,
        queueEntryId: createQueueEntryId(track.filePath),
    };
};

const snapshotFromCache = getPlaylistCacheSnapshot();
let queueHydratedFromSnapshot = false;
let pendingInitialTrackRestore: { track: QueuedTrack; autoPlay: boolean } | null = null;

const playbackHistory: number[] = [];
const MAX_HISTORY_LENGTH = 100;

if (snapshotFromCache.queue.length > 0) {
    const hydratedTracks = snapshotFromCache.queue.map(createQueuedTrackFromPersisted);
    queue$.tracks.set(hydratedTracks);
    perfLog("Queue.hydrateFromPlaylistCache", { tracks: hydratedTracks.length });

    const resolvedIndex =
        snapshotFromCache.currentIndex != null &&
        snapshotFromCache.currentIndex >= 0 &&
        snapshotFromCache.currentIndex < hydratedTracks.length
            ? snapshotFromCache.currentIndex
            : -1;

    if (resolvedIndex >= 0) {
        const currentTrack = hydratedTracks[resolvedIndex];
        localPlayerState$.currentTrack.set(currentTrack);
        localPlayerState$.currentIndex.set(resolvedIndex);
        pendingInitialTrackRestore = {
            track: currentTrack,
            autoPlay: false,
        };
    } else {
        localPlayerState$.currentTrack.set(null);
        localPlayerState$.currentIndex.set(-1);
        pendingInitialTrackRestore = null;
    }

    localPlayerState$.isPlaying.set(false);
    localPlayerState$.isLoading.set(false);
    queueHydratedFromSnapshot = true;
}

const serializeQueuedTrack = (track: QueuedTrack): PersistedQueuedTrack => ({
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    filePath: track.filePath,
    thumbnail: track.thumbnail,
    thumbnailKey: track.thumbnailKey,
});

type PlaylistSnapshotPayload = Omit<PlaylistSnapshot, "version" | "updatedAt">;

type PlaylistSnapshotSignature = {
    queueRef: QueuedTrack[];
    queueLength: number;
    currentIndex: number;
    isPlaying: boolean;
};

const makePlaylistSnapshotSignature = (): PlaylistSnapshotSignature => {
    const queueRef = queue$.tracks.peek();
    const queueLength = queueRef.length;
    const currentIndex = queueLength ? clampIndex(localPlayerState$.currentIndex.peek(), queueLength) : -1;

    return {
        queueRef,
        queueLength,
        currentIndex,
        isPlaying: localPlayerState$.isPlaying.peek() && queueLength > 0,
    };
};

const buildPlaylistSnapshot = (signature: PlaylistSnapshotSignature): PlaylistSnapshotPayload => ({
    queue: signature.queueRef.map(serializeQueuedTrack),
    currentIndex: signature.currentIndex,
    isPlaying: signature.isPlaying,
});

let lastPlaylistSnapshotSignature: PlaylistSnapshotSignature | null = null;

const schedulePlaylistSnapshotPersist = () => {
    runAfterInteractions(() => {
        const signature = makePlaylistSnapshotSignature();
        if (
            lastPlaylistSnapshotSignature &&
            lastPlaylistSnapshotSignature.queueRef === signature.queueRef &&
            lastPlaylistSnapshotSignature.queueLength === signature.queueLength &&
            lastPlaylistSnapshotSignature.currentIndex === signature.currentIndex &&
            lastPlaylistSnapshotSignature.isPlaying === signature.isPlaying
        ) {
            return;
        }

        const snapshot = buildPlaylistSnapshot(signature);
        persistPlaylistSnapshot(snapshot);
        lastPlaylistSnapshotSignature = signature;
    });
};

// Flag to track if queue has been loaded from cache
let queueInitialized = queueHydratedFromSnapshot;

interface QueueUpdateOptions {
    playImmediately?: boolean;
    startIndex?: number;
}

type QueueInput = LocalTrack | LocalTrack[];

let audioPlayer: ReturnType<typeof useAudioPlayer> | null = null;

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

const handleMissingTrackFile = (track: LocalTrack, queueEntryId?: string) => {
    const label = track.title || track.fileName || track.filePath;
    showToast(`Track not found: ${label}`, "error");
    if (queueEntryId) {
        updateQueueEntry(queueEntryId, { isMissing: true });
    }
    localPlayerState$.error.set("Track file not found");
    localPlayerState$.isLoading.set(false);
    localPlayerState$.isPlaying.set(false);
};

const handleTrackLoadFailure = (track: LocalTrack, queueEntryId: string | undefined, errorMessage: string) => {
    const exists = trackFileExists(track.filePath);
    if (!exists) {
        handleMissingTrackFile(track, queueEntryId);
        return;
    }

    localPlayerState$.error.set(errorMessage);
    localPlayerState$.isLoading.set(false);
    localPlayerState$.isPlaying.set(false);
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

function setQueueTracks(tracks: QueuedTrack[]): void {
    queue$.tracks.set(tracks);
    schedulePlaylistSnapshotPersist();

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

localPlayerState$.currentIndex.onChange(() => {
    schedulePlaylistSnapshotPersist();
});

localPlayerState$.currentTrack.onChange(() => {
    schedulePlaylistSnapshotPersist();
});

localPlayerState$.isPlaying.onChange(() => {
    schedulePlaylistSnapshotPersist();
});

function resetPlayerForEmptyQueue(): void {
    localPlayerState$.currentTrack.set(null);
    localPlayerState$.currentIndex.set(-1);
    localPlayerState$.currentTime.set(0);
    localPlayerState$.duration.set(0);
    localPlayerState$.isPlaying.set(false);
    pendingInitialTrackRestore = null;
    if (audioPlayer) {
        audioPlayer.stop().catch((error) => console.error("Error stopping playback:", error));
        audioPlayer.clearNowPlayingInfo();
    }
}

async function play(): Promise<void> {
    perfLog("LocalAudioControls.play");
    if (!audioPlayer) {
        return;
    }

    try {
        const duration = localPlayerState$.duration.peek();
        const currentTime = localPlayerState$.currentTime.peek();
        const shouldRestart = duration > 0 && duration - currentTime <= 2;

        if (shouldRestart) {
            localPlayerState$.currentTime.set(0);
            try {
                await audioPlayer.seek(0);
            } catch (seekError) {
                console.error("Error seeking to restart playback:", seekError);
            }
        }

        await audioPlayer.play();
    } catch (error) {
        console.error("Error playing:", error);
        localPlayerState$.error.set(error instanceof Error ? error.message : "Play failed");
    }
}

async function pause(): Promise<void> {
    perfLog("LocalAudioControls.pause");
    if (!audioPlayer) {
        return;
    }

    try {
        await audioPlayer.pause();
    } catch (error) {
        console.error("Error pausing:", error);
    }
}

async function loadTrackInternal(track: LocalTrack, autoPlay: boolean): Promise<void> {
    perfLog("LocalAudioControls.loadTrack", { id: track.id, filePath: track.filePath, autoPlay });
    if (__DEV__) {
        if (DEBUG_AUDIO_LOGS) {
            console.log("Loading track:", track.title, "by", track.artist);
        }
    }

    localPlayerState$.currentTrack.set(track);
    localPlayerState$.currentTime.set(0);
    localPlayerState$.duration.set(0);
    localPlayerState$.isLoading.set(true);
    localPlayerState$.error.set(null);
    const queueEntryId = isQueuedTrack(track) ? track.queueEntryId : undefined;

    if (!trackFileExists(track.filePath)) {
        handleMissingTrackFile(track, queueEntryId);
        return;
    }

    if (audioPlayer) {
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
    }

    void ensureLocalTrackThumbnail(track).then((thumbnail) => {
        if (!thumbnail) {
            return;
        }

        const thumbnailKey = track.thumbnailKey;
        const updates: Partial<QueuedTrack> = thumbnailKey ? { thumbnail, thumbnailKey } : { thumbnail };

        if (queueEntryId) {
            updateQueueEntry(queueEntryId, updates);
        }

        const current = localPlayerState$.currentTrack.peek();
        const isCurrentTrack = current && current.id === track.id;
        const hasNewThumbnail =
            current &&
            (current.thumbnail !== thumbnail || (thumbnailKey && current.thumbnailKey !== thumbnailKey));

        if (isCurrentTrack && hasNewThumbnail) {
            localPlayerState$.currentTrack.set({ ...current, ...updates });
        }

        if (audioPlayer) {
            audioPlayer.updateNowPlayingInfo({ artwork: thumbnail });
        }
    });

    if (!audioPlayer) {
        localPlayerState$.isLoading.set(false);
        return;
    }

    try {
        const result = await audioPlayer.loadTrack(track.filePath);
        if (result.success) {
            perfLog("LocalAudioControls.loadTrack.success", { filePath: track.filePath });
            if (autoPlay) {
                await play();
            }
        } else {
            const errorMessage = result.error || "Failed to load track";
            perfLog("LocalAudioControls.loadTrack.error", errorMessage);
            handleTrackLoadFailure(track, queueEntryId, errorMessage);
        }
    } catch (error) {
        console.error("Error loading track:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        handleTrackLoadFailure(track, queueEntryId, errorMessage);
    }
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

    const currentIndex = localPlayerState$.currentIndex.peek();
    if (options.recordHistory && currentIndex !== -1 && currentIndex !== targetIndex) {
        pushHistory(currentIndex);
    }

    const track = tracks[targetIndex];
    localPlayerState$.currentIndex.set(targetIndex);
    void loadTrackInternal(track, options.playImmediately ?? true);
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

    const currentIndex = localPlayerState$.currentIndex.peek();
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

    const currentIndex = localPlayerState$.currentIndex.peek();
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
        localPlayerState$.currentIndex.set(currentIndex + queuedAdditions.length);
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

    const currentIndex = localPlayerState$.currentIndex.peek();
    if (currentIndex === -1) {
        return;
    }

    const currentTrack = tracks[currentIndex];
    if (!currentTrack) {
        localPlayerState$.currentIndex.set(Math.min(currentIndex, nextQueue.length - 1));
        return;
    }

    const nextCurrentIndex = nextQueue.findIndex((track) => track.queueEntryId === currentTrack.queueEntryId);
    if (nextCurrentIndex !== -1) {
        localPlayerState$.currentIndex.set(nextCurrentIndex);
    } else {
        localPlayerState$.currentIndex.set(Math.min(currentIndex, nextQueue.length - 1));
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

    const currentIndex = localPlayerState$.currentIndex.peek();
    if (currentIndex === -1) {
        return;
    }

    const removedBeforeCurrent = uniqueSorted.filter((index) => index < currentIndex).length;

    if (removalSet.has(currentIndex)) {
        const isPlaying = localPlayerState$.isPlaying.peek();
        const nextIndex = Math.min(currentIndex - removedBeforeCurrent, nextQueue.length - 1);

        if (nextIndex >= 0) {
            playTrackFromQueue(nextIndex, { playImmediately: isPlaying, startIndex: nextIndex });
        } else {
            resetPlayerForEmptyQueue();
        }
        return;
    }

    const nextIndex = Math.max(0, currentIndex - removedBeforeCurrent);
    localPlayerState$.currentIndex.set(nextIndex);
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

async function initializeQueueFromCache(): Promise<void> {
    if (queueInitialized) {
        return;
    }

    if (queueHydratedFromSnapshot) {
        queueInitialized = true;
        return;
    }

    try {
        perfLog("Queue.initializeFromCache");
        const savedTracks = await loadQueueFromM3U();

        if (savedTracks.length > 0) {
            // Convert to queued tracks without triggering save
            clearHistory();
            const queuedTracks = savedTracks.map(createQueuedTrack);
            queue$.tracks.set(queuedTracks);
            if (DEBUG_AUDIO_LOGS) {
                console.log(`Restored queue with ${queuedTracks.length} tracks from cache`);
            }
        }
    } catch (error) {
        console.error("Failed to initialize queue from cache:", error);
    } finally {
        queueInitialized = true;
    }
}

export const queueControls = {
    replace: queueReplace,
    append: queueAppend,
    insertNext: queueInsertNext,
    insertAt: queueInsertAt,
    reorder: queueReorder,
    remove: queueRemoveIndices,
    clear: queueClear,
    initializeFromCache: initializeQueueFromCache,
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

        await loadTrackInternal(track, true);
        return;
    }

    const options = (arg2 as QueueUpdateOptions | undefined) ?? {};
    localPlayerState$.currentIndex.set(-1);
    await loadTrackInternal(arg1, options.playImmediately ?? true);
}

function loadPlaylist(playlist: LocalTrack[], startIndex = 0, options: QueueUpdateOptions = {}): void {
    queueReplace(playlist, { startIndex, playImmediately: options.playImmediately ?? true });
}

async function togglePlayPause(): Promise<void> {
    perfLog("LocalAudioControls.togglePlayPause", { isPlaying: localPlayerState$.isPlaying.get() });
    if (localPlayerState$.currentTrack.get()) {
        const isPlaying = localPlayerState$.isPlaying.get();
        if (isPlaying) {
            await pause();
        } else {
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
    const currentIndex = localPlayerState$.currentIndex.peek();
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
    const currentIndex = localPlayerState$.currentIndex.peek();
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
        const duration = localPlayerState$.duration.peek();
        localPlayerState$.currentTime.set(duration);
        localPlayerState$.isPlaying.set(false);
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
    localPlayerState$.volume.set(clampedVolume);
    if (!audioPlayer) {
        return;
    }

    try {
        await audioPlayer.setVolume(clampedVolume);
    } catch (error) {
        console.error("Error setting volume:", error);
    }
}

async function seek(seconds: number): Promise<void> {
    perfLog("LocalAudioControls.seek", { seconds });
    if (!audioPlayer) {
        return;
    }

    try {
        await audioPlayer.seek(seconds);
    } catch (error) {
        console.error("Error seeking:", error);
    }
}

function getCurrentState(): LocalPlayerState {
    return localPlayerState$.get();
}

async function restoreTrackFromSnapshotIfNeeded(): Promise<void> {
    if (!audioPlayer || !pendingInitialTrackRestore) {
        return;
    }

    const { track, autoPlay } = pendingInitialTrackRestore;
    pendingInitialTrackRestore = null;
    await loadTrackInternal(track, autoPlay);
}

// Expose control methods for local audio
export const localAudioControls = {
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

export function LocalAudioPlayer() {
    const player = useAudioPlayer();
    perfCount("LocalAudioPlayer.render");

    // Initialize queue from cache on first mount
    useEffect(() => {
        void initializeQueueFromCache();
    }, []);

    // Set global reference
    useEffect(() => {
        perfLog("LocalAudioPlayer.useEffect[player]", { hasPlayer: !!player });
        audioPlayer = player;
        void restoreTrackFromSnapshotIfNeeded();
        return () => {
            perfLog("LocalAudioPlayer.cleanup[player]");
            player.clearNowPlayingInfo();
            audioPlayer = null;
        };
    }, [player]);

    // Set up event listeners
    useEffect(() => {
        const listeners = [
            player.addListener("onLoadSuccess", (data) => {
                perfCount("LocalAudioPlayer.onLoadSuccess");
                const delta = perfDelta("LocalAudioPlayer.onLoadSuccess");
                perfLog("LocalAudioPlayer.onLoadSuccess", { delta, data });
                if (__DEV__) {
                    if (DEBUG_AUDIO_LOGS) {
                        console.log("Audio loaded successfully:", data);
                    }
                }
                localPlayerState$.duration.set(data.duration);
                localPlayerState$.isLoading.set(false);
                localPlayerState$.error.set(null);
                player.updateNowPlayingInfo({ duration: data.duration });
            }),

            player.addListener("onLoadError", (data) => {
                perfCount("LocalAudioPlayer.onLoadError");
                const delta = perfDelta("LocalAudioPlayer.onLoadError");
                perfLog("LocalAudioPlayer.onLoadError", { delta, data });
                console.error("Audio load error:", data.error);
                localPlayerState$.error.set(data.error);
                localPlayerState$.isLoading.set(false);
                localPlayerState$.isPlaying.set(false);
            }),

            player.addListener("onPlaybackStateChanged", (data) => {
                perfCount("LocalAudioPlayer.onPlaybackStateChanged");
                const delta = perfDelta("LocalAudioPlayer.onPlaybackStateChanged");
                perfLog("LocalAudioPlayer.onPlaybackStateChanged", { delta, data });
                if (__DEV__) {
                    if (DEBUG_AUDIO_LOGS) {
                        console.log("Playback state changed:", data.isPlaying);
                    }
                }
                localPlayerState$.isPlaying.set(data.isPlaying);
            }),

            player.addListener("onProgress", (data) => {
                perfCount("LocalAudioPlayer.onProgress");
                const delta = perfDelta("LocalAudioPlayer.onProgress");
                perfLog("LocalAudioPlayer.onProgress", { delta, current: data.currentTime, duration: data.duration });
                if (!playbackInteractionState$.isScrubbing.peek()) {
                    localPlayerState$.currentTime.set(data.currentTime);
                }
                if (data.duration !== localPlayerState$.duration.peek()) {
                    localPlayerState$.duration.set(data.duration);
                }
            }),

            player.addListener("onCompletion", () => {
                perfCount("LocalAudioPlayer.onCompletion");
                const delta = perfDelta("LocalAudioPlayer.onCompletion");
                perfLog("LocalAudioPlayer.onCompletion", { delta });
                if (__DEV__) {
                    if (DEBUG_AUDIO_LOGS) {
                        console.log("Track completed, playing next if available");
                    }
                }
                const duration = localPlayerState$.duration.peek();
                localPlayerState$.currentTime.set(duration);
                localPlayerState$.isPlaying.set(false);
                localAudioControls.playNext();
            }),

            player.addListener("onRemoteCommand", ({ command }) => {
                perfCount("LocalAudioPlayer.onRemoteCommand");
                perfLog("LocalAudioPlayer.onRemoteCommand", { command });
                switch (command) {
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
            }),
        ];

        return () => {
            listeners.forEach((listener) => listener.remove());
        };
    }, [player]);

    return <View className="w-0 h-0 opacity-0 absolute" />;
}
