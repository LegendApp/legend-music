import { observable } from "@legendapp/state";
import type { LibrarySnapshot, PersistedLibraryTrack } from "@/systems/LibraryCache";
import { getLibrarySnapshot, hasCachedLibraryData, persistLibrarySnapshot } from "@/systems/LibraryCache";
import { type LocalTrack, localMusicSettings$, localMusicState$ } from "@/systems/LocalMusicState";
import { createJSONManager } from "@/utils/JSONManager";
import { getCacheDirectory } from "@/utils/cacheDirectories";
import { perfCount, perfLog, perfTime } from "@/utils/perfLogger";
import { runAfterInteractions } from "@/utils/runAfterInteractions";

export interface LibraryItem {
    id: string;
    type: "artist" | "album" | "playlist" | "track" | "all";
    name: string;
    children?: LibraryItem[];
    trackCount?: number;
    duration?: number;
    album?: string;
    artist?: string;
}

export interface LibraryTrack extends LocalTrack {
    // LibraryTrack extends LocalTrack which already has album?: string
}

// Library UI state (persistent)
export const libraryUI$ = createJSONManager({
    filename: "libraryUI",
    initialValue: {
        isOpen: false,
        selectedItem: null as LibraryItem | null,
        searchQuery: "",
        selectedCollection: "artists" as "artists" | "albums" | "playlists",
    },
});

// Non-persistent UI state
export const libraryUIState$ = observable({
    // Add any non-persistent state here if needed
});

// Library data derived from local music state
export const library$ = observable({
    artists: [] as LibraryItem[],
    albums: [] as LibraryItem[],
    playlists: [] as LibraryItem[],
    tracks: [] as LibraryTrack[],
    isScanning: false,
    lastScanTime: null as Date | null,
});

type LibrarySnapshotPayload = Omit<LibrarySnapshot, "version" | "updatedAt">;

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

const deriveThumbnailKey = (thumbnail: string | undefined): string | undefined => {
    if (!thumbnail) {
        return undefined;
    }

    const lastSlash = thumbnail.lastIndexOf("/");
    const fileName = lastSlash === -1 ? thumbnail : thumbnail.slice(lastSlash + 1);
    const [baseName] = fileName.split(".");
    return baseName && baseName.length > 0 ? baseName : undefined;
};

const resolveRelativePathForTrack = (
    track: LocalTrack,
    roots: string[],
): { rootIndex: number; relativePath: string } => {
    const normalizedFilePath = normalizeRootPath(track.filePath);

    for (let i = 0; i < roots.length; i++) {
        const root = roots[i];
        if (root && normalizedFilePath.startsWith(root)) {
            const relativePath = normalizedFilePath.slice(root.length).replace(/^\/+/, "");
            return {
                rootIndex: i,
                relativePath: relativePath.length > 0 ? relativePath : fileNameFromPath(normalizedFilePath),
            };
        }
    }

    return {
        rootIndex: roots.length > 0 ? 0 : 0,
        relativePath: normalizedFilePath,
    };
};

const buildPersistedTrack = (track: LocalTrack, roots: string[]): PersistedLibraryTrack => {
    const { rootIndex, relativePath } = resolveRelativePathForTrack(track, roots);
    const thumbnailKey = track.thumbnailKey ?? deriveThumbnailKey(track.thumbnail);

    return {
        root: rootIndex,
        rel: relativePath,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        thumb: thumbnailKey,
    };
};

const buildFilePathFromPersisted = (track: PersistedLibraryTrack, roots: string[]): string => {
    const root = roots[track.root];
    if (root) {
        if (track.rel.startsWith("/")) {
            return `${root}${track.rel}`;
        }

        if (root.endsWith("/")) {
            return `${root}${track.rel}`;
        }

        return `${root}/${track.rel}`;
    }

    return track.rel;
};

const buildThumbnailUri = (baseUri: string, key: string | undefined): string | undefined => {
    if (!key || !baseUri) {
        return undefined;
    }

    const normalizedBase = baseUri.endsWith("/") ? baseUri.slice(0, -1) : baseUri;
    return `${normalizedBase}/${key}.png`;
};

const collectLibrarySnapshot = (sourceTracks: LibraryTrack[]): LibrarySnapshotPayload => {
    const lastScan = library$.lastScanTime.peek();
    const roots = localMusicSettings$.libraryPaths.get().map((path) => normalizeRootPath(path)).filter(Boolean);
    const tracks = sourceTracks.map((track) => buildPersistedTrack(track, roots));

    return {
        tracks,
        roots,
        isScanning: library$.isScanning.peek(),
        lastScanTime: lastScan instanceof Date ? lastScan.getTime() : null,
    };
};

type LibrarySnapshotSignature = {
    tracksRef: PersistedLibraryTrack[];
    tracksLength: number;
    isScanning: boolean;
    lastScanTime: number | null;
    rootsHash: string;
    sourceTracksRef: LibraryTrack[];
};

const makeLibrarySnapshotSignature = (
    snapshot: LibrarySnapshotPayload,
    sourceTracksRef: LibraryTrack[],
): LibrarySnapshotSignature => ({
    tracksRef: snapshot.tracks,
    tracksLength: snapshot.tracks.length,
    isScanning: snapshot.isScanning,
    lastScanTime: snapshot.lastScanTime,
    rootsHash: snapshot.roots.join("|"),
    sourceTracksRef,
});

let lastLibrarySnapshotSignature: LibrarySnapshotSignature | null = null;

const scheduleLibrarySnapshotPersist = () => {
    runAfterInteractions(() => {
        const sourceTracks = library$.tracks.peek();
        const snapshot = collectLibrarySnapshot(sourceTracks);
        const signature = makeLibrarySnapshotSignature(snapshot, sourceTracks);
        if (
            lastLibrarySnapshotSignature &&
            lastLibrarySnapshotSignature.sourceTracksRef === signature.sourceTracksRef &&
            lastLibrarySnapshotSignature.tracksLength === signature.tracksLength &&
            lastLibrarySnapshotSignature.isScanning === signature.isScanning &&
            lastLibrarySnapshotSignature.lastScanTime === signature.lastScanTime &&
            lastLibrarySnapshotSignature.rootsHash === signature.rootsHash
        ) {
            return;
        }

        persistLibrarySnapshot(snapshot);
        lastLibrarySnapshotSignature = signature;
    });
};

function normalizeTracks(localTracks: LocalTrack[]): LibraryTrack[] {
    perfCount("LibraryState.normalizeTracks");
    return perfTime("LibraryState.normalizeTracks", () => localTracks);
}

function buildArtistItems(tracks: LibraryTrack[]): LibraryItem[] {
    perfCount("LibraryState.buildArtistItems");
    const artistMap = new Map<string, { count: number }>();

    for (const track of tracks) {
        const entry = artistMap.get(track.artist);
        if (entry) {
            entry.count += 1;
        } else {
            artistMap.set(track.artist, { count: 1 });
        }
    }

    return Array.from(artistMap.entries())
        .map(([name, { count }]) => ({
            id: `artist-${slugify(name)}`,
            type: "artist" as const,
            name,
            trackCount: count,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function buildAlbumItems(tracks: LibraryTrack[]): LibraryItem[] {
    perfCount("LibraryState.buildAlbumItems");

    const albumMap = new Map<
        string,
        {
            album: string;
            artist: string | undefined;
            count: number;
        }
    >();

    for (const track of tracks) {
        const albumName = track.album?.trim() || "Unknown Album";
        const key = albumName.toLowerCase();
        const entry = albumMap.get(key);

        if (entry) {
            entry.count += 1;
        } else {
            albumMap.set(key, {
                album: albumName,
                artist: track.artist,
                count: 1,
            });
        }
    }

    return Array.from(albumMap.values())
        .map(({ album, artist, count }) => ({
            id: `album-${slugify(`${album}-${artist ?? "various"}`)}`,
            type: "album" as const,
            name: album,
            album,
            artist,
            trackCount: count,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function slugify(value: string): string {
    const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return slug || "unknown";
}

function syncLibraryFromLocalState(): void {
    perfLog("LibraryState.sync.start");
    const localTracks = localMusicState$.tracks.get();
    const normalizedTracks = normalizeTracks(localTracks);

    library$.tracks.set(normalizedTracks);
    library$.artists.set(buildArtistItems(normalizedTracks));
    library$.albums.set(buildAlbumItems(normalizedTracks));
    perfLog("LibraryState.sync.end", { trackCount: normalizedTracks.length });
    scheduleLibrarySnapshotPersist();
}

syncLibraryFromLocalState();
library$.isScanning.set(localMusicState$.isScanning.get());
const initialLastScan = localMusicSettings$.lastScanTime.get();
library$.lastScanTime.set(initialLastScan ? new Date(initialLastScan) : null);
const initialTracks = library$.tracks.peek();
lastLibrarySnapshotSignature = makeLibrarySnapshotSignature(collectLibrarySnapshot(initialTracks), initialTracks);

localMusicState$.tracks.onChange(syncLibraryFromLocalState);
localMusicState$.isScanning.onChange(({ value }) => {
    library$.isScanning.set(value);
    scheduleLibrarySnapshotPersist();
});

localMusicSettings$.lastScanTime.onChange(({ value }) => {
    library$.lastScanTime.set(value ? new Date(value) : null);
    scheduleLibrarySnapshotPersist();
});

library$.artists.onChange(() => {
    scheduleLibrarySnapshotPersist();
});

library$.albums.onChange(() => {
    scheduleLibrarySnapshotPersist();
});

library$.playlists.onChange(() => {
    scheduleLibrarySnapshotPersist();
});

library$.tracks.onChange(() => {
    scheduleLibrarySnapshotPersist();
});

library$.isScanning.onChange(() => {
    scheduleLibrarySnapshotPersist();
});

library$.lastScanTime.onChange(() => {
    scheduleLibrarySnapshotPersist();
});

export let libraryHydratedFromCache = false;

export const isLibraryCacheAvailable = (): boolean => hasCachedLibraryData();

export const hydrateLibraryFromCache = (): boolean => {
    const snapshot = getLibrarySnapshot();
    const hasData = snapshot.tracks.length > 0;

    if (!hasData) {
        return false;
    }

    const thumbnailsDir = getCacheDirectory("thumbnails");
    const thumbnailBaseUri = thumbnailsDir.uri;
    const roots = Array.isArray(snapshot.roots) ? snapshot.roots.map((root) => normalizeRootPath(root)) : [];

    const tracks = snapshot.tracks.map((track) => {
        const filePath = buildFilePathFromPersisted(track, roots);

        return {
            id: filePath,
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
            filePath,
            fileName: fileNameFromPath(filePath),
            thumbnailKey: track.thumb,
            thumbnail: buildThumbnailUri(thumbnailBaseUri, track.thumb) ?? track.thumbnail,
        };
    });

    library$.tracks.set(tracks);
    library$.artists.set(buildArtistItems(tracks));
    library$.albums.set(buildAlbumItems(tracks));
    library$.isScanning.set(snapshot.isScanning);
    library$.lastScanTime.set(snapshot.lastScanTime ? new Date(snapshot.lastScanTime) : null);

    lastLibrarySnapshotSignature = makeLibrarySnapshotSignature(
        {
            tracks: snapshot.tracks,
            roots,
            isScanning: snapshot.isScanning,
            lastScanTime: snapshot.lastScanTime,
        },
        tracks,
    );

    libraryHydratedFromCache = true;
    return true;
};
