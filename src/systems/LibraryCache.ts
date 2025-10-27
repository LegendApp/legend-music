import type { LibraryItem, LibraryTrack } from "@/systems/LibraryState";
import { createJSONManager } from "@/utils/JSONManager";

export interface LibrarySnapshot {
    version: number;
    updatedAt: number;
    artists: LibraryItem[];
    albums: LibraryItem[];
    playlists: LibraryItem[];
    tracks: LibraryTrack[];
    isScanning: boolean;
    lastScanTime: number | null;
}

const LIBRARY_CACHE_VERSION = 1;

const defaultSnapshot: LibrarySnapshot = {
    version: LIBRARY_CACHE_VERSION,
    updatedAt: 0,
    artists: [],
    albums: [],
    playlists: [],
    tracks: [],
    isScanning: false,
    lastScanTime: null,
};

const libraryCache$ = createJSONManager<LibrarySnapshot>({
    filename: "libraryCache",
    initialValue: defaultSnapshot,
    format: "msgpack",
    saveTimeout: 0,
});

const sanitizeItems = (items: LibraryItem[] | undefined): LibraryItem[] => {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        children: item.children ? sanitizeItems(item.children) : undefined,
        trackCount: item.trackCount,
        duration: item.duration,
        album: item.album,
        artist: item.artist,
    }));
};

const sanitizeTracks = (tracks: LibraryTrack[] | undefined): LibraryTrack[] => {
    if (!Array.isArray(tracks)) {
        return [];
    }

    return tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        filePath: track.filePath,
        fileName: track.fileName,
        thumbnail: track.thumbnail,
    }));
};

const sanitizeSnapshot = (input: Partial<LibrarySnapshot>): LibrarySnapshot => ({
    version: LIBRARY_CACHE_VERSION,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
    artists: sanitizeItems(input.artists),
    albums: sanitizeItems(input.albums),
    playlists: sanitizeItems(input.playlists),
    tracks: sanitizeTracks(input.tracks),
    isScanning: Boolean(input.isScanning),
    lastScanTime: typeof input.lastScanTime === "number" ? input.lastScanTime : null,
});

export const getLibrarySnapshot = (): LibrarySnapshot => {
    const snapshot = libraryCache$.get();
    if (!snapshot || snapshot.version !== LIBRARY_CACHE_VERSION) {
        return defaultSnapshot;
    }

    return sanitizeSnapshot(snapshot);
};

export const persistLibrarySnapshot = (
    snapshot: Omit<LibrarySnapshot, "version" | "updatedAt"> & Partial<Pick<LibrarySnapshot, "updatedAt">>,
) => {
    const sanitized = sanitizeSnapshot({
        ...snapshot,
        updatedAt: snapshot.updatedAt ?? Date.now(),
    });

    libraryCache$.set(sanitized);
};

export const hasCachedLibraryData = (): boolean => {
    const snapshot = getLibrarySnapshot();
    return (
        snapshot.artists.length > 0 ||
        snapshot.albums.length > 0 ||
        snapshot.playlists.length > 0 ||
        snapshot.tracks.length > 0
    );
};
