import { createJSONManager } from "@/utils/JSONManager";

export interface PersistedLibraryTrack {
    filePath: string;
    title: string;
    artist: string;
    album?: string;
    duration: string;
    thumbnail?: string;
}

export interface LibrarySnapshot {
    version: number;
    updatedAt: number;
    tracks: PersistedLibraryTrack[];
    isScanning: boolean;
    lastScanTime: number | null;
}

const LIBRARY_CACHE_VERSION = 2;

const defaultSnapshot: LibrarySnapshot = {
    version: LIBRARY_CACHE_VERSION,
    updatedAt: 0,
    tracks: [],
    isScanning: false,
    lastScanTime: null,
};

const libraryCache$ = createJSONManager<LibrarySnapshot>({
    filename: "libraryCache",
    initialValue: defaultSnapshot,
    format: "msgpack",
    saveTimeout: 0,
    preload: false,
});

type LegacyLibraryTrack = {
    id?: string;
    title?: string;
    artist?: string;
    album?: string;
    duration?: string;
    filePath?: string;
    fileName?: string;
    thumbnail?: string;
};

type LegacyLibrarySnapshot = Partial<LibrarySnapshot> & {
    artists?: unknown;
    albums?: unknown;
    playlists?: unknown;
    tracks?: LegacyLibraryTrack[] | PersistedLibraryTrack[];
};

const sanitizeTrack = (track: LegacyLibraryTrack | PersistedLibraryTrack): PersistedLibraryTrack | null => {
    const filePath =
        typeof track.filePath === "string" && track.filePath
            ? track.filePath
            : typeof track.id === "string"
              ? track.id
              : "";

    if (!filePath) {
        return null;
    }

    return {
        filePath,
        title: typeof track.title === "string" && track.title.length > 0 ? track.title : filePath,
        artist: typeof track.artist === "string" && track.artist.length > 0 ? track.artist : "Unknown Artist",
        album: typeof track.album === "string" && track.album.length > 0 ? track.album : undefined,
        duration: typeof track.duration === "string" && track.duration.length > 0 ? track.duration : "0:00",
        thumbnail: typeof track.thumbnail === "string" && track.thumbnail.length > 0 ? track.thumbnail : undefined,
    };
};

const sanitizeSnapshot = (input: LegacyLibrarySnapshot): LibrarySnapshot => {
    const tracks = Array.isArray(input.tracks)
        ? input.tracks
              .map((track) => sanitizeTrack(track))
              .filter((track): track is PersistedLibraryTrack => Boolean(track))
        : [];

    return {
        version: LIBRARY_CACHE_VERSION,
        updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
        tracks,
        isScanning: Boolean(input.isScanning),
        lastScanTime: typeof input.lastScanTime === "number" ? input.lastScanTime : null,
    };
};

export const getLibrarySnapshot = (): LibrarySnapshot => {
    const snapshot = libraryCache$.get();
    if (!snapshot) {
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

export const hasCachedLibraryData = (): boolean => getLibrarySnapshot().tracks.length > 0;
