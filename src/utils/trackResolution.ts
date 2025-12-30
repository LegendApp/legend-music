import { getArtistKey, type LibraryItem, type LibraryTrack } from "@/systems/LibraryState";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { DEFAULT_LOCAL_PLAYLIST_ID } from "@/systems/localMusicConstants";
import { formatSecondsToMmSs, type M3UTrack } from "@/utils/m3u";

export interface PlaylistResolutionSource {
    id: string;
    name?: string;
    type?: string;
    trackPaths?: string[];
    trackEntries?: M3UTrack[];
}

export interface PlaylistResolutionResult {
    tracks: LocalTrack[];
    missingPaths: string[];
}

export const isSpotifyUri = (value: string): boolean => value.toLowerCase().startsWith("spotify:");

export function buildTrackFromPlaylistEntry(entry: M3UTrack): LocalTrack {
    const durationSeconds = Number.isFinite(entry.duration) && entry.duration > 0 ? entry.duration : 0;
    const duration = durationSeconds > 0 ? formatSecondsToMmSs(durationSeconds) : " ";
    const title = entry.title || entry.filePath.split("/").pop() || entry.filePath;
    const artist = entry.artist ?? "Unknown Artist";
    const isSpotify = isSpotifyUri(entry.filePath);

    return {
        id: entry.id || entry.filePath,
        title,
        artist,
        duration,
        filePath: entry.filePath,
        fileName: title,
        thumbnail: entry.logo,
        addedAt: entry.addedAt,
        provider: isSpotify ? "spotify" : undefined,
        uri: isSpotify ? entry.filePath : undefined,
        durationMs: durationSeconds > 0 ? durationSeconds * 1000 : undefined,
    };
}

const buildFallbackEntry = (filePath: string): M3UTrack => ({
    id: filePath,
    duration: -1,
    title: filePath.split("/").pop() || filePath,
    filePath,
});

export function resolvePlaylistTracks(
    source: PlaylistResolutionSource,
    allTracks: LocalTrack[],
    trackLookup: Map<string, LocalTrack>,
): PlaylistResolutionResult {
    if (source.type === "local-files" || source.id === DEFAULT_LOCAL_PLAYLIST_ID) {
        return {
            tracks: allTracks,
            missingPaths: [],
        };
    }

    const trackEntries = source.trackEntries ?? (source.trackPaths ?? []).map(buildFallbackEntry);
    if (trackEntries.length === 0) {
        return {
            tracks: [],
            missingPaths: [],
        };
    }

    const resolvedTracks: LocalTrack[] = [];
    const missingPaths: string[] = [];

    for (const entry of trackEntries) {
        const track = trackLookup.get(entry.filePath);
        if (track) {
            resolvedTracks.push(track);
            continue;
        }

        if (isSpotifyUri(entry.filePath)) {
            resolvedTracks.push(buildTrackFromPlaylistEntry(entry));
            continue;
        }

        missingPaths.push(entry.filePath);
    }

    return {
        tracks: resolvedTracks,
        missingPaths,
    };
}

export interface LibraryItemTracksOptions {
    allTracksPlaylistId?: string;
}

export function getTracksForLibraryItem(
    tracks: LibraryTrack[],
    item: LibraryItem | null,
    options: LibraryItemTracksOptions = {},
): LibraryTrack[] {
    if (!item) {
        return [];
    }

    if (item.children?.length) {
        const childIds = new Set(item.children.map((child) => child.id));
        return tracks.filter((track) => childIds.has(track.id));
    }

    switch (item.type) {
        case "artist":
            return tracks.filter((track) => {
                const targetArtistKey = getArtistKey(item.name);
                const trackArtistKey = getArtistKey(track.artist);
                return trackArtistKey === targetArtistKey;
            });
        case "album": {
            const albumName = item.album ?? item.name ?? "Unknown Album";
            return tracks.filter((track) => (track.album ?? "Unknown Album") === albumName);
        }
        case "playlist":
            if (options.allTracksPlaylistId && item.id === options.allTracksPlaylistId) {
                return tracks;
            }
            return tracks;
        case "track":
            return tracks.filter((track) => track.id === item.id);
        default:
            return [];
    }
}

export function buildTrackLookup(tracks: LocalTrack[]): Map<string, LocalTrack> {
    return new Map(tracks.map((track) => [track.filePath, track]));
}
