import { observable } from "@legendapp/state";
import { Directory, File } from "expo-file-system/next";
import * as ID3 from "id3js";
import { stateSaved$ } from "@/systems/State";
import { createJSONManager } from "@/utils/JSONManager";

export interface LocalTrack {
    id: string;
    title: string;
    artist: string;
    duration: string;
    filePath: string;
    fileName: string;
    thumbnail?: string;
}

export interface LocalMusicSettings {
    libraryPaths: string[];
    autoScanOnStart: boolean;
    lastScanTime: number;
}

export interface LocalMusicState {
    tracks: LocalTrack[];
    isScanning: boolean;
    scanProgress: number;
    scanTotal: number;
    error: string | null;
    currentPlaylistId: string | null;
    isLocalFilesSelected: boolean;
}

// Settings persistence
export const localMusicSettings$ = createJSONManager<LocalMusicSettings>({
    filename: "localMusicSettings",
    initialValue: {
        libraryPaths: ["/Users/jay/Downloads/mp3"],
        autoScanOnStart: true,
        lastScanTime: 0,
    },
});

// Runtime state
export const localMusicState$ = observable<LocalMusicState>({
    tracks: [],
    isScanning: false,
    scanProgress: 0,
    scanTotal: 0,
    error: null,
    currentPlaylistId: null,
    isLocalFilesSelected: false,
});

// Extract metadata from ID3 tags with filename fallback
async function extractId3Metadata(
    filePath: string,
    fileName: string,
): Promise<{ title: string; artist: string; duration?: string }> {
    try {
        // First try to extract ID3 tags
        const tags = await ID3.fromPath(filePath);

        if (tags && (tags.title || tags.artist)) {
            return {
                title: tags.title || parseFilenameOnly(fileName).title,
                artist: tags.artist || parseFilenameOnly(fileName).artist,
                duration: tags.duration ? formatDuration(tags.duration) : undefined,
            };
        }
    } catch (error) {
        console.warn(`Failed to read ID3 tags from ${fileName}:`, error);
    }

    // Fallback to filename parsing if ID3 tags are unavailable or incomplete
    return parseFilenameOnly(fileName);
}

// Fallback: Extract metadata from filename (original logic)
function parseFilenameOnly(fileName: string): {
    title: string;
    artist: string;
} {
    // Remove extension
    let name = fileName.replace(/\.mp3$/i, "");

    // Decode URL-encoded characters (like %20 for spaces)
    try {
        name = decodeURIComponent(name);
    } catch (error) {
        // If decoding fails, use the original name
        console.warn(`Failed to decode filename: ${fileName}`, error);
    }

    // Try to parse "Artist - Title" format
    if (name.includes(" - ")) {
        const [artist, title] = name.split(" - ", 2);
        return {
            title: title.trim(),
            artist: artist.trim(),
        };
    }

    // If no artist separator, use filename as title
    return {
        title: name.trim(),
        artist: "Unknown Artist",
    };
}

// Format duration from seconds to MM:SS format
function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Generate unique ID for track
function generateTrackId(filePath: string): string {
    return `local_${filePath.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

// Scan directory for MP3 files
async function scanDirectory(directoryPath: string): Promise<LocalTrack[]> {
    const tracks: LocalTrack[] = [];

    try {
        const directory = new Directory(directoryPath);

        if (!directory.exists) {
            console.warn(`Directory does not exist: ${directoryPath}`);
            return tracks;
        }

        const items = directory.list();

        for (const item of items) {
            if (item instanceof File && item.name.toLowerCase().endsWith(".mp3")) {
                // Decode the filename for the file path
                let decodedFileName = item.name;
                try {
                    decodedFileName = decodeURIComponent(item.name);
                } catch (error) {
                    console.warn(`Failed to decode filename: ${item.name}`, error);
                }

                const filePath = `${directoryPath}/${decodedFileName}`;

                try {
                    // Extract metadata from ID3 tags with filename fallback
                    const metadata = await extractId3Metadata(filePath, item.name);

                    const track: LocalTrack = {
                        id: generateTrackId(filePath),
                        title: metadata.title,
                        artist: metadata.artist,
                        duration: metadata.duration || "0:00",
                        filePath,
                        fileName: item.name,
                    };

                    tracks.push(track);
                } catch (error) {
                    console.error(`Failed to process MP3 file ${item.name}:`, error);
                    // Continue with other files
                }
            }
        }

        console.log(`Found ${tracks.length} MP3 files in ${directoryPath}`);
        return tracks;
    } catch (error) {
        console.error(`Error scanning directory ${directoryPath}:`, error);
        throw error;
    }
}

// Scan all configured library paths
export async function scanLocalMusic(): Promise<void> {
    const paths = localMusicSettings$.libraryPaths.get();

    if (paths.length === 0) {
        localMusicState$.error.set("No library paths configured");
        return;
    }

    localMusicState$.isScanning.set(true);
    localMusicState$.error.set(null);
    localMusicState$.scanProgress.set(0);
    localMusicState$.scanTotal.set(paths.length);

    const allTracks: LocalTrack[] = [];

    try {
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            console.log(`Scanning directory: ${path}`);

            try {
                const tracks = await scanDirectory(path);
                allTracks.push(...tracks);
            } catch (error) {
                console.error(`Failed to scan ${path}:`, error);
                // Continue with other directories
            }

            localMusicState$.scanProgress.set(i + 1);
        }

        // Sort tracks by artist then title
        allTracks.sort((a, b) => {
            const artistCompare = a.artist.localeCompare(b.artist);
            if (artistCompare !== 0) return artistCompare;
            return a.title.localeCompare(b.title);
        });

        localMusicState$.tracks.set(allTracks);
        localMusicSettings$.lastScanTime.set(Date.now());

        console.log(`Scan complete: Found ${allTracks.length} total MP3 files`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        localMusicState$.error.set(`Scan failed: ${errorMessage}`);
        console.error("Local music scan failed:", error);
    } finally {
        localMusicState$.isScanning.set(false);
    }
}

// Set current playlist selection
export function setCurrentPlaylist(playlistId: string): void {
    localMusicState$.currentPlaylistId.set(playlistId);
    localMusicState$.isLocalFilesSelected.set(playlistId === "LOCAL_FILES");

    // Save current playlist to persistent state
    stateSaved$.playlist.set(playlistId);
}

// Initialize and scan on app start
export function initializeLocalMusic(): void {
    const settings = localMusicSettings$.get();

    // Restore saved playlist selection
    const savedPlaylist = stateSaved$.playlist.get();
    if (savedPlaylist) {
        console.log("Restoring saved playlist:", savedPlaylist);
        setCurrentPlaylist(savedPlaylist);
    }

    if (settings.autoScanOnStart) {
        console.log("Auto-scanning local music on startup...");
        scanLocalMusic().catch((error) => {
            console.error("Failed to auto-scan local music:", error);
        });
    }
}
