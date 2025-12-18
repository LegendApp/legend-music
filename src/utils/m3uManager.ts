import { File } from "expo-file-system/next";
import { DEBUG_QUEUE_LOGS } from "@/systems/constants";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { ensureCacheDirectory, getCacheDirectory, getPlaylistsDirectory } from "@/utils/cacheDirectories";
import { formatSecondsToMmSs, type M3UTrack, parseDurationToSeconds, parseM3U, writeM3U } from "@/utils/m3u";

const QUEUE_FILE_PATH = "queue.m3u";

/**
 * Converts LocalTrack to M3UTrack
 */
function localTrackToM3UTrack(track: LocalTrack): M3UTrack | null {
    if (track.provider && track.provider !== "local") {
        return null;
    }

    // Convert duration from "mm:ss" format to seconds
    const durationSeconds = parseDurationToSeconds(track.duration);

    return {
        id: track.filePath,
        duration: durationSeconds,
        title: track.title,
        artist: track.artist,
        filePath: track.filePath,
    };
}

/**
 * Converts M3UTrack to LocalTrack
 */
function m3uTrackToLocalTrack(track: M3UTrack): LocalTrack {
    // Convert duration from seconds to "mm:ss" format
    const durationString = formatSecondsToMmSs(track.duration);

    // Extract filename from path
    const fileName = track.filePath.split("/").pop() || track.filePath;

    return {
        id: track.filePath,
        title: track.title,
        artist: track.artist || "Unknown Artist",
        duration: durationString,
        filePath: track.filePath,
        fileName,
    };
}

/**
 * Saves tracks to queue.m3u file
 */
export async function saveQueueToM3U(tracks: LocalTrack[]): Promise<void> {
    try {
        const m3uTracks = tracks
            .map(localTrackToM3UTrack)
            .filter((track): track is M3UTrack => track !== null);
        const playlist = { songs: m3uTracks, suggestions: [] };
        const m3uContent = writeM3U(playlist);

        const directory = getPlaylistsDirectory();
        ensureCacheDirectory(directory);

        const file = new File(directory, QUEUE_FILE_PATH);
        file.write(m3uContent);
        if (DEBUG_QUEUE_LOGS) {
            console.log(`Saved queue with ${tracks.length} tracks to ${QUEUE_FILE_PATH}`);
        }
    } catch (error) {
        console.error("Failed to save queue to M3U:", error);
    }
}

/**
 * Loads tracks from queue.m3u file
 */
export function loadQueueFromM3U(): LocalTrack[] {
    try {
        const directory = getPlaylistsDirectory();
        ensureCacheDirectory(directory);
        const file = new File(directory, QUEUE_FILE_PATH);

        if (!file.exists) {
            if (DEBUG_QUEUE_LOGS) {
                console.log("No queue.m3u file found, starting with empty queue");
            }
            return [];
        }

        const content = file.text();
        const playlist = parseM3U(content);
        const tracks = playlist.songs.map(m3uTrackToLocalTrack);

        if (DEBUG_QUEUE_LOGS) {
            console.log(`Loaded queue with ${tracks.length} tracks from ${QUEUE_FILE_PATH}`);
        }
        return tracks;
    } catch (error) {
        console.error("Failed to load queue from M3U:", error);
        return [];
    }
}

/**
 * Deletes the queue.m3u file
 */
export async function clearQueueM3U(): Promise<void> {
    try {
        const directory = getPlaylistsDirectory();
        ensureCacheDirectory(directory);
        const file = new File(directory, QUEUE_FILE_PATH);
        if (file.exists) {
            file.delete();
            if (DEBUG_QUEUE_LOGS) {
                console.log("Cleared queue.m3u file");
            }
        }
    } catch (error) {
        console.error("Failed to clear queue M3U:", error);
    }
}
