import { createJSONManager } from "@/utils/JSONManager";

export interface PersistedQueuedTrack {
    filePath: string;
    title: string;
    artist: string;
    album?: string;
    duration: string;
    thumbnail?: string;
}

export interface PlaylistSnapshot {
    version: number;
    updatedAt: number;
    queue: PersistedQueuedTrack[];
    currentIndex: number;
    isPlaying: boolean;
}

const PLAYLIST_CACHE_VERSION = 2;

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
    format: "msgpack",
    saveTimeout: 0,
    preload: false,
});

type LegacyQueuedTrack = {
    id?: string;
    title?: string;
    artist?: string;
    album?: string;
    duration?: string;
    filePath?: string;
    fileName?: string;
    queueEntryId?: string;
    thumbnail?: string;
};

const getFileName = (filePath: string): string => {
    const lastSlash = filePath.lastIndexOf("/");
    return lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1);
};

const sanitizeTrack = (input: LegacyQueuedTrack | PersistedQueuedTrack): PersistedQueuedTrack | null => {
    const filePath =
        typeof input.filePath === "string" && input.filePath
            ? input.filePath
            : typeof input.id === "string"
              ? input.id
              : "";

    if (!filePath) {
        return null;
    }

    return {
        filePath,
        title: typeof input.title === "string" && input.title.length > 0 ? input.title : getFileName(filePath),
        artist: typeof input.artist === "string" && input.artist.length > 0 ? input.artist : "Unknown Artist",
        album: typeof input.album === "string" && input.album.length > 0 ? input.album : undefined,
        duration: typeof input.duration === "string" && input.duration.length > 0 ? input.duration : "0:00",
        thumbnail: typeof input.thumbnail === "string" && input.thumbnail.length > 0 ? input.thumbnail : undefined,
    };
};

const sanitizeSnapshot = (input: Partial<PlaylistSnapshot>): PlaylistSnapshot => {
    const queue = Array.isArray(input.queue)
        ? input.queue
              .map((track) => sanitizeTrack(track))
              .filter((track): track is PersistedQueuedTrack => Boolean(track))
        : [];
    const hasQueue = queue.length > 0;

    const currentIndex =
        typeof input.currentIndex === "number" && input.currentIndex >= 0 && input.currentIndex < queue.length
            ? input.currentIndex
            : hasQueue
              ? Math.min(Math.max(input.currentIndex ?? 0, 0), queue.length - 1)
              : -1;

    return {
        version: PLAYLIST_CACHE_VERSION,
        updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
        queue,
        currentIndex,
        isPlaying: Boolean(input.isPlaying && hasQueue),
    };
};

export const getPlaylistCacheSnapshot = (): PlaylistSnapshot => {
    const snapshot = playlistCache$.get();
    if (!snapshot) {
        return defaultSnapshot;
    }

    return sanitizeSnapshot(snapshot);
};

export const persistPlaylistSnapshot = (snapshot: Omit<PlaylistSnapshot, "version" | "updatedAt">) => {
    const sanitized = sanitizeSnapshot({
        ...snapshot,
        updatedAt: Date.now(),
    });

    playlistCache$.set(sanitized);
};

export const hasCachedPlaylistData = (): boolean => getPlaylistCacheSnapshot().queue.length > 0;
