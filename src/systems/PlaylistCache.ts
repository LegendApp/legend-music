import { createJSONManager } from "@/utils/JSONManager";

export interface PersistedQueuedTrack {
    filePath: string;
    title: string;
    artist: string;
    album?: string;
    duration: string;
}

export interface PlaylistSnapshot {
    version: number;
    updatedAt: number;
    queue: PersistedQueuedTrack[];
    currentIndex: number;
    isPlaying: boolean;
}

const PLAYLIST_CACHE_VERSION = 1;

const defaultSnapshot: PlaylistSnapshot = {
    version: PLAYLIST_CACHE_VERSION,
    updatedAt: 0,
    queue: [],
    currentIndex: -1,
    isPlaying: false,
};

const playlistCache$ = createJSONManager<PlaylistSnapshot>({
    filename: "playlistCache",
    initialValue: defaultSnapshot,
    format: "json",
    saveTimeout: 0,
    preload: false,
});

export const getPlaylistCacheSnapshot = (): PlaylistSnapshot => {
    try {
        const snapshot = playlistCache$.get();
        if (!snapshot || !Array.isArray(snapshot.queue) || snapshot.version !== PLAYLIST_CACHE_VERSION) {
            const resetSnapshot: PlaylistSnapshot = { ...defaultSnapshot, updatedAt: Date.now() };
            playlistCache$.set(resetSnapshot);
            return resetSnapshot;
        }

        return snapshot;
    } catch (error) {
        console.error("Failed to read playlist cache; resetting to defaults", error);
        const resetSnapshot: PlaylistSnapshot = { ...defaultSnapshot, updatedAt: Date.now() };
        playlistCache$.set(resetSnapshot);
        return resetSnapshot;
    }
};

export const persistPlaylistSnapshot = (snapshot: Omit<PlaylistSnapshot, "version" | "updatedAt">) => {
    playlistCache$.set({
        ...snapshot,
        version: PLAYLIST_CACHE_VERSION,
        updatedAt: Date.now(),
    });
};

export const hasCachedPlaylistData = (): boolean => getPlaylistCacheSnapshot().queue.length > 0;

export const clearPlaylistCache = (): void => {
    playlistCache$.set({
        ...defaultSnapshot,
        updatedAt: Date.now(),
    });
};
