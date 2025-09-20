import { observable } from "@legendapp/state";
import { useEffect } from "react";
import { View } from "react-native";
import { useAudioPlayer } from "@/native-modules/AudioPlayer";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { ensureLocalTrackThumbnail } from "@/systems/LocalMusicState";
import { perfCount, perfDelta, perfLog } from "@/utils/perfLogger";

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
}

export interface PlaybackQueueState {
    tracks: QueuedTrack[];
}

export const queue$ = observable<PlaybackQueueState>({
    tracks: [],
});

interface QueueUpdateOptions {
    playImmediately?: boolean;
    startIndex?: number;
}

type QueueInput = LocalTrack | LocalTrack[];

let audioPlayer: ReturnType<typeof useAudioPlayer> | null = null;
let queueEntryCounter = 0;

function createQueueEntryId(seed: string): string {
    queueEntryCounter += 1;
    return `${seed}-${Date.now()}-${queueEntryCounter}`;
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
}

function resetPlayerForEmptyQueue(): void {
    localPlayerState$.currentTrack.set(null);
    localPlayerState$.currentIndex.set(-1);
    localPlayerState$.currentTime.set(0);
    localPlayerState$.duration.set(0);
    localPlayerState$.isPlaying.set(false);
    if (audioPlayer) {
        audioPlayer.stop().catch((error) => console.error("Error stopping playback:", error));
    }
}

async function play(): Promise<void> {
    perfLog("LocalAudioControls.play");
    if (!audioPlayer) {
        return;
    }

    try {
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
        console.log("Loading track:", track.title, "by", track.artist);
    }

    localPlayerState$.currentTrack.set(track);
    localPlayerState$.isLoading.set(true);
    localPlayerState$.error.set(null);

    const queueEntryId = isQueuedTrack(track) ? track.queueEntryId : undefined;
    void ensureLocalTrackThumbnail(track).then((thumbnail) => {
        if (!thumbnail) {
            return;
        }

        if (queueEntryId) {
            updateQueueEntry(queueEntryId, { thumbnail });
        }

        const current = localPlayerState$.currentTrack.peek();
        if (current && current.id === track.id && current.thumbnail !== thumbnail) {
            localPlayerState$.currentTrack.set({ ...current, thumbnail });
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
            localPlayerState$.error.set(errorMessage);
            localPlayerState$.isLoading.set(false);
        }
    } catch (error) {
        console.error("Error loading track:", error);
        localPlayerState$.error.set(error instanceof Error ? error.message : "Unknown error");
        localPlayerState$.isLoading.set(false);
    }
}

function playTrackFromQueue(index: number, options: QueueUpdateOptions = {}): void {
    const tracks = getQueueSnapshot();
    const targetIndex = clampIndex(options.startIndex ?? index, tracks.length);

    if (tracks.length === 0 || targetIndex === -1) {
        resetPlayerForEmptyQueue();
        return;
    }

    const track = tracks[targetIndex];
    localPlayerState$.currentIndex.set(targetIndex);
    void loadTrackInternal(track, options.playImmediately ?? true);
}

function queueReplace(tracksInput: LocalTrack[], options: QueueUpdateOptions = {}): void {
    perfLog("Queue.replace", { length: tracksInput.length, startIndex: options.startIndex });
    const tracks = tracksInput.map(createQueuedTrack);
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

function queueClear(): void {
    perfLog("Queue.clear");
    setQueueTracks([]);
    resetPlayerForEmptyQueue();
}

export const queueControls = {
    replace: queueReplace,
    append: queueAppend,
    insertNext: queueInsertNext,
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
    const isPlaying = localPlayerState$.isPlaying.get();
    if (isPlaying) {
        await pause();
    } else {
        await play();
    }
}

function playPrevious(): void {
    const currentIndex = localPlayerState$.currentIndex.peek();
    const tracks = getQueueSnapshot();
    perfLog("LocalAudioControls.playPrevious", { currentIndex, queueLength: tracks.length });
    if (tracks.length === 0 || currentIndex <= 0) {
        return;
    }

    const newIndex = currentIndex - 1;
    playTrackFromQueue(newIndex, { playImmediately: true, startIndex: newIndex });
}

function playNext(): void {
    const currentIndex = localPlayerState$.currentIndex.peek();
    const tracks = getQueueSnapshot();
    perfLog("LocalAudioControls.playNext", { currentIndex, queueLength: tracks.length });
    if (tracks.length === 0) {
        return;
    }

    if (currentIndex < tracks.length - 1) {
        const newIndex = currentIndex + 1;
        playTrackFromQueue(newIndex, { playImmediately: true, startIndex: newIndex });
    } else {
        localPlayerState$.isPlaying.set(false);
    }
}

function playTrackAtIndex(index: number): void {
    const tracks = getQueueSnapshot();
    perfLog("LocalAudioControls.playTrackAtIndex", { index, queueLength: tracks.length });
    if (tracks.length === 0 || index < 0 || index >= tracks.length) {
        return;
    }

    playTrackFromQueue(index, { playImmediately: true, startIndex: index });
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

// Expose control methods for local audio
export const localAudioControls = {
    loadTrack,
    loadPlaylist,
    play,
    pause,
    togglePlayPause,
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

    // Set global reference
    useEffect(() => {
        perfLog("LocalAudioPlayer.useEffect[player]", { hasPlayer: !!player });
        audioPlayer = player;
        return () => {
            perfLog("LocalAudioPlayer.cleanup[player]");
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
                    console.log("Audio loaded successfully:", data);
                }
                localPlayerState$.duration.set(data.duration);
                localPlayerState$.isLoading.set(false);
                localPlayerState$.error.set(null);
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
                    console.log("Playback state changed:", data.isPlaying);
                }
                localPlayerState$.isPlaying.set(data.isPlaying);
            }),

            player.addListener("onProgress", (data) => {
                perfCount("LocalAudioPlayer.onProgress");
                const delta = perfDelta("LocalAudioPlayer.onProgress");
                perfLog("LocalAudioPlayer.onProgress", { delta, current: data.currentTime, duration: data.duration });
                localPlayerState$.currentTime.set(data.currentTime);
                if (data.duration !== localPlayerState$.duration.peek()) {
                    localPlayerState$.duration.set(data.duration);
                }
            }),

            player.addListener("onCompletion", () => {
                perfCount("LocalAudioPlayer.onCompletion");
                const delta = perfDelta("LocalAudioPlayer.onCompletion");
                perfLog("LocalAudioPlayer.onCompletion", { delta });
                if (__DEV__) {
                    console.log("Track completed, playing next if available");
                }
                localPlayerState$.isPlaying.set(false);
                localAudioControls.playNext();
            }),
        ];

        return () => {
            listeners.forEach((listener) => listener.remove());
        };
    }, [player]);

    return <View className="w-0 h-0 opacity-0 absolute" />;
}
