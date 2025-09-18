import { observable } from "@legendapp/state";
import { type LocalTrack, localMusicSettings$, localMusicState$ } from "@/systems/LocalMusicState";
import { createJSONManager } from "@/utils/JSONManager";
import { perfCount, perfLog, perfTime } from "@/utils/perfLogger";

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
    album?: string;
}

// Library UI state (persistent)
export const libraryUI$ = createJSONManager({
    filename: "libraryUI",
    initialValue: {
        isOpen: true,
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
}

syncLibraryFromLocalState();
library$.isScanning.set(localMusicState$.isScanning.get());
const initialLastScan = localMusicSettings$.lastScanTime.get();
library$.lastScanTime.set(initialLastScan ? new Date(initialLastScan) : null);

localMusicState$.tracks.onChange(syncLibraryFromLocalState);
localMusicState$.isScanning.onChange(({ value }) => {
    library$.isScanning.set(value);
});

localMusicSettings$.lastScanTime.onChange(({ value }) => {
    library$.lastScanTime.set(value ? new Date(value) : null);
});
