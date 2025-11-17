import { deleteCacheFiles } from "@/utils/cacheDirectories";
import { createJSONManager } from "@/utils/JSONManager";

export interface PersistedLibraryTrack {
    rootIndex: number;
    relativePath: string;
    fileName: string;
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
    roots: string[];
}

const LIBRARY_CACHE_VERSION = 3;

const defaultSnapshot: LibrarySnapshot = {
    version: LIBRARY_CACHE_VERSION,
    updatedAt: 0,
    tracks: [],
    isScanning: false,
    lastScanTime: null,
    roots: [],
};

const libraryCache$ = createJSONManager<LibrarySnapshot>({
    filename: "libraryCache",
    initialValue: defaultSnapshot,
    format: "msgpack",
    saveTimeout: 0,
    preload: false,
});

deleteCacheFiles("data", ["libraryCache.json"]);

type LegacyLibraryTrack = {
    rootIndex?: number;
    relativePath?: string;
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
    roots?: unknown;
};

const normalizeRootPath = (path: string): string => {
    if (!path) {
        return "";
    }

    const withoutPrefix = path.startsWith("file://") ? path.replace("file://", "") : path;
    const trimmed = withoutPrefix.replace(/\/+$/, "");
    return trimmed.length > 0 ? trimmed : withoutPrefix;
};

const fileNameFromPath = (path: string): string => {
    const lastSlash = path.lastIndexOf("/");
    return lastSlash === -1 ? path : path.slice(lastSlash + 1);
};

const deriveRelativePath = (
    track: LegacyLibraryTrack | PersistedLibraryTrack,
    roots: string[],
): { rootIndex: number; relativePath: string } => {
    const preferredRootIndex =
        typeof track.rootIndex === "number" && track.rootIndex >= 0 && track.rootIndex < roots.length
            ? track.rootIndex
            : 0;

    if (typeof (track as PersistedLibraryTrack).relativePath === "string") {
        return { rootIndex: preferredRootIndex, relativePath: (track as PersistedLibraryTrack).relativePath };
    }

    const filePath = typeof track.filePath === "string" && track.filePath ? track.filePath : "";

    if (!filePath) {
        return { rootIndex: preferredRootIndex, relativePath: "" };
    }

    for (let i = 0; i < roots.length; i++) {
        const root = roots[i];
        if (root && filePath.startsWith(root)) {
            const relative = filePath.slice(root.length).replace(/^\/+/, "");
            return { rootIndex: i, relativePath: relative.length > 0 ? relative : fileNameFromPath(filePath) };
        }
    }

    return { rootIndex: preferredRootIndex, relativePath: filePath };
};

const sanitizeTrack = (
    track: LegacyLibraryTrack | PersistedLibraryTrack,
    roots: string[],
): PersistedLibraryTrack | null => {
    const { rootIndex, relativePath } = deriveRelativePath(track, roots);

    if (!relativePath) {
        return null;
    }

    const fileName =
        typeof track.fileName === "string" && track.fileName.length > 0 ? track.fileName : fileNameFromPath(relativePath);

    return {
        rootIndex: rootIndex >= 0 ? rootIndex : 0,
        relativePath,
        fileName,
        title: typeof track.title === "string" && track.title.length > 0 ? track.title : fileName,
        artist: typeof track.artist === "string" && track.artist.length > 0 ? track.artist : "Unknown Artist",
        album: typeof track.album === "string" && track.album.length > 0 ? track.album : undefined,
        duration: typeof track.duration === "string" && track.duration.length > 0 ? track.duration : "0:00",
        thumbnail: typeof track.thumbnail === "string" && track.thumbnail.length > 0 ? track.thumbnail : undefined,
    };
};

const sanitizeSnapshot = (input: LegacyLibrarySnapshot): LibrarySnapshot => {
    const roots = Array.isArray(input.roots)
        ? input.roots
              .map((root) => (typeof root === "string" ? normalizeRootPath(root) : ""))
              .filter((root): root is string => root.length > 0)
        : [];

    const tracks = Array.isArray(input.tracks)
        ? input.tracks
              .map((track) => sanitizeTrack(track, roots))
              .filter((track): track is PersistedLibraryTrack => Boolean(track))
        : [];

    return {
        version: LIBRARY_CACHE_VERSION,
        updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : Date.now(),
        tracks,
        isScanning: Boolean(input.isScanning),
        lastScanTime: typeof input.lastScanTime === "number" ? input.lastScanTime : null,
        roots,
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

export const clearLibraryCache = (): void => {
    libraryCache$.set({
        ...defaultSnapshot,
        updatedAt: Date.now(),
    });
};
