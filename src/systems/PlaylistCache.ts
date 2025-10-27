import { createJSONManager } from "@/utils/JSONManager";

export interface SerializedQueuedTrack {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration: string;
    filePath: string;
    fileName: string;
    queueEntryId: string;
    thumbnail?: string;
}

export interface PlaylistSnapshot {
    version: number;
    updatedAt: number;
    queue: SerializedQueuedTrack[];
    currentQueueEntryId: string | null;
    currentIndex: number;
    isPlaying: boolean;
}

const PLAYLIST_CACHE_VERSION = 1;

const defaultSnapshot: PlaylistSnapshot = {
    version: PLAYLIST_CACHE_VERSION,
    updatedAt: 0,
    queue: [],
    currentQueueEntryId: null,
    currentIndex: -1,
    isPlaying: false,
};

const playlistCache$ = createJSONManager<PlaylistSnapshot>({
    filename: "playlistCache",
    initialValue: defaultSnapshot,
    format: "msgpack",
    saveTimeout: 0,
});

const sanitizeTrack = (input: SerializedQueuedTrack): SerializedQueuedTrack => ({
    id: input.id,
    title: input.title,
    artist: input.artist,
    album: input.album,
    duration: input.duration,
    filePath: input.filePath,
    fileName: input.fileName,
    queueEntryId: input.queueEntryId,
    thumbnail: input.thumbnail,
});

const sanitizeSnapshot = (input: Partial<PlaylistSnapshot>): PlaylistSnapshot => {
    const queue = Array.isArray(input.queue) ? input.queue.map(sanitizeTrack) : [];
    const hasQueue = queue.length > 0;

    const currentIndex =
        typeof input.currentIndex === "number" && input.currentIndex >= 0 && input.currentIndex < queue.length
            ? input.currentIndex
            : hasQueue
              ? Math.min(Math.max(input.currentIndex ?? 0, 0), queue.length - 1)
              : -1;

    const currentQueueEntryId = currentIndex >= 0 ? queue[currentIndex]?.queueEntryId ?? null : null;

    return {
        version: PLAYLIST_CACHE_VERSION,
        updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
        queue,
        currentQueueEntryId,
        currentIndex,
        isPlaying: Boolean(input.isPlaying && hasQueue),
    };
};

export const getPlaylistCacheSnapshot = (): PlaylistSnapshot => {
    const snapshot = playlistCache$.get();
    if (!snapshot || snapshot.version !== PLAYLIST_CACHE_VERSION) {
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
