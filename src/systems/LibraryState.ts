import { observable } from "@legendapp/state";
import { type LocalTrack, localMusicSettings$, localMusicState$ } from "@/systems/LocalMusicState";
import { createJSONManager } from "@/utils/JSONManager";

export interface LibraryItem {
    id: string;
    type: "artist" | "album" | "playlist" | "track" | "all";
    name: string;
    children?: LibraryItem[];
    trackCount?: number;
    duration?: number;
}

export interface LibraryTrack {
    id: string;
    title: string;
    artist: string;
    duration: string;
    filePath: string;
    fileName: string;
    album?: string;
    thumbnail?: string;
}

// Library UI state (persistent)
export const libraryUI$ = createJSONManager({
    filename: "libraryUI",
    initialValue: {
        isOpen: false,
        selectedItem: null as LibraryItem | null,
        searchQuery: "",
        expandedNodes: [] as string[],
    },
});

// Non-persistent UI state
export const libraryUIState$ = observable({
    // Add any non-persistent state here if needed
});

// Library data derived from local music state
export const library$ = observable({
    artists: [] as LibraryItem[],
    playlists: [] as LibraryItem[],
    tracks: [] as LibraryTrack[],
    isScanning: false,
    lastScanTime: null as Date | null,
});

function normalizeTracks(localTracks: LocalTrack[]): LibraryTrack[] {
    return localTracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        filePath: track.filePath,
        fileName: track.fileName,
        thumbnail: track.thumbnail,
    }));
}

function buildArtistItems(tracks: LibraryTrack[]): LibraryItem[] {
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

function slugify(value: string): string {
    const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return slug || "unknown";
}

function syncLibraryFromLocalState(): void {
    const localTracks = localMusicState$.tracks.get();
    const normalizedTracks = normalizeTracks(localTracks);

    library$.tracks.set(normalizedTracks);
    library$.artists.set(buildArtistItems(normalizedTracks));
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
