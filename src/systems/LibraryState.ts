import { observable } from "@legendapp/state";
import type { LibrarySnapshot } from "@/systems/LibraryCache";
import { getLibrarySnapshot, hasCachedLibraryData, persistLibrarySnapshot } from "@/systems/LibraryCache";
import { type LocalTrack, localMusicSettings$, localMusicState$ } from "@/systems/LocalMusicState";
import { createJSONManager } from "@/utils/JSONManager";
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

const collectLibrarySnapshot = (): LibrarySnapshotPayload => {
    const lastScan = library$.lastScanTime.peek();

    return {
        tracks: library$.tracks.peek(),
        isScanning: library$.isScanning.peek(),
        lastScanTime: lastScan instanceof Date ? lastScan.getTime() : null,
    };
};

let lastLibrarySnapshotKey: string | null = null;

const scheduleLibrarySnapshotPersist = () => {
    runAfterInteractions(() => {
        const snapshot = collectLibrarySnapshot();
        const snapshotKey = JSON.stringify(snapshot);
        if (snapshotKey === lastLibrarySnapshotKey) {
            return;
        }

        persistLibrarySnapshot(snapshot);
        lastLibrarySnapshotKey = snapshotKey;
    });
};

function normalizeTracks(localTracks: LocalTrack[]): LibraryTrack[] {
    perfCount("LibraryState.normalizeTracks");
    return perfTime("LibraryState.normalizeTracks", () => localTracks.map((track) => ({ ...track })));
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
lastLibrarySnapshotKey = JSON.stringify(collectLibrarySnapshot());

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

    const tracks = snapshot.tracks.map((track) => ({
        id: track.filePath,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        filePath: track.filePath,
        fileName: track.filePath.split("/").pop() ?? track.filePath,
        thumbnail: track.thumbnail,
    }));

    library$.tracks.set(tracks);
    library$.artists.set(buildArtistItems(tracks));
    library$.albums.set(buildAlbumItems(tracks));
    library$.isScanning.set(snapshot.isScanning);
    library$.lastScanTime.set(snapshot.lastScanTime ? new Date(snapshot.lastScanTime) : null);

    lastLibrarySnapshotKey = JSON.stringify({
        tracks: snapshot.tracks,
        isScanning: snapshot.isScanning,
        lastScanTime: snapshot.lastScanTime,
    });

    libraryHydratedFromCache = true;
    return true;
};
