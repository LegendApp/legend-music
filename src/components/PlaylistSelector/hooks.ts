import { use$ } from "@legendapp/state/react";
import { File } from "expo-file-system/next";
import { useCallback, useMemo } from "react";

import { localAudioControls } from "@/components/LocalAudioPlayer";
import type { LibraryItem, LibraryTrack } from "@/systems/LibraryState";
import { libraryUI$ } from "@/systems/LibraryState";
import type { LocalMusicState, LocalPlaylist, LocalTrack } from "@/systems/LocalMusicState";
import {
    DEFAULT_LOCAL_PLAYLIST_ID,
    DEFAULT_LOCAL_PLAYLIST_NAME,
    loadLocalPlaylists,
    setCurrentPlaylist,
} from "@/systems/LocalMusicState";
import { stateSaved$ } from "@/systems/State";
import { ensureCacheDirectory, getCacheDirectory } from "@/utils/cacheDirectories";
import { perfLog } from "@/utils/perfLogger";
import type { QueueAction } from "@/utils/queueActions";
import { buildTrackLookup, getTracksForLibraryItem, resolvePlaylistTracks } from "@/utils/trackResolution";

interface PlaylistOption {
    id: string;
    name: string;
    count: number;
    type: "local-files" | "saved";
    trackPaths?: string[];
}

interface UsePlaylistOptionsResult {
    availablePlaylistIds: string[];
    playlistMap: Map<string, PlaylistOption>;
    tracksByPath: Map<string, LocalTrack>;
}

export function usePlaylistOptions(localMusicState: LocalMusicState): UsePlaylistOptionsResult {
    const localFilesPlaylist = useMemo<PlaylistOption>(
        () => ({
            id: DEFAULT_LOCAL_PLAYLIST_ID,
            name: DEFAULT_LOCAL_PLAYLIST_NAME,
            count: localMusicState.tracks.length,
            type: "local-files",
        }),
        [localMusicState.tracks.length],
    );

    const savedPlaylistOptions = useMemo<PlaylistOption[]>(
        () =>
            localMusicState.playlists.map((playlist) => ({
                id: playlist.id,
                name:
                    playlist.id === DEFAULT_LOCAL_PLAYLIST_ID
                        ? DEFAULT_LOCAL_PLAYLIST_NAME
                        : playlist.name,
                count: playlist.trackCount,
                type: "saved" as const,
                trackPaths: playlist.trackPaths,
            })),
        [localMusicState.playlists],
    );

    const availablePlaylists = useMemo(
        () => [localFilesPlaylist, ...savedPlaylistOptions],
        [localFilesPlaylist, savedPlaylistOptions],
    );

    const availablePlaylistIds = useMemo(() => availablePlaylists.map((playlist) => playlist.id), [availablePlaylists]);

    const playlistMap = useMemo(
        () => new Map(availablePlaylists.map((playlist) => [playlist.id, playlist])),
        [availablePlaylists],
    );

    const tracksByPath = useMemo(() => buildTrackLookup(localMusicState.tracks), [localMusicState.tracks]);

    return {
        availablePlaylistIds,
        playlistMap,
        tracksByPath,
    };
}

interface PlaylistQueueHandlersInput {
    playlistMap: Map<string, PlaylistOption>;
    tracksByPath: Map<string, LocalTrack>;
    localTracks: LocalTrack[];
    libraryTracks: LibraryTrack[];
}

interface PlaylistQueueHandlersResult {
    handlePlaylistSelect: (playlistId: string) => void;
    handleTrackSelect: (track: LocalTrack, action: QueueAction) => void;
    handleLibraryItemSelect: (item: LibraryItem, action: QueueAction) => void;
    handleSearchPlaylistSelect: (playlist: LocalPlaylist) => void;
}

export function usePlaylistQueueHandlers({
    playlistMap,
    tracksByPath,
    localTracks,
    libraryTracks,
}: PlaylistQueueHandlersInput): PlaylistQueueHandlersResult {
    const handlePlaylistSelect = useCallback(
        (playlistId: string) => {
            const playlist = playlistMap.get(playlistId);

            if (!playlist) {
                console.warn("Playlist not found:", playlistId);
                return;
            }

            perfLog("PlaylistSelector.handlePlaylistSelect", { playlistId });

            const { tracks: resolvedTracks, missingPaths } = resolvePlaylistTracks(
                {
                    id: playlist.id,
                    name: playlist.name,
                    type: playlist.type,
                    trackPaths: playlist.trackPaths,
                },
                localTracks,
                tracksByPath,
            );

            if (resolvedTracks.length > 0) {
                localAudioControls.queue.replace(resolvedTracks, { startIndex: 0, playImmediately: true });
            } else if (playlist.type !== "local-files") {
                console.warn(`No tracks resolved for playlist ${playlist.name}`);
                localAudioControls.queue.clear();
            }

            if (missingPaths.length > 0) {
                console.warn(`Playlist ${playlist.name} is missing ${missingPaths.length} tracks from the library`);
            }

            setCurrentPlaylist(playlistId, "file");
        },
        [localTracks, playlistMap, tracksByPath],
    );

    const handleTrackSelect = useCallback((track: LocalTrack, action: QueueAction) => {
        perfLog("PlaylistSelector.handleTrackSelect", { trackId: track.id, action });

        switch (action) {
            case "play-now":
                localAudioControls.queue.insertNext(track, { playImmediately: true });
                break;
            case "play-next":
                localAudioControls.queue.insertNext(track);
                break;
            default:
                localAudioControls.queue.append(track);
                break;
        }
    }, []);

    const handleLibraryItemSelect = useCallback(
        (item: LibraryItem, action: QueueAction) => {
            perfLog("PlaylistSelector.handleLibraryItemSelect", { itemId: item.id, type: item.type, action });

            const tracksToAdd = getTracksForLibraryItem(libraryTracks, item);
            if (tracksToAdd.length === 0) {
                return;
            }

            switch (action) {
                case "play-now":
                    localAudioControls.queue.insertNext(tracksToAdd, { playImmediately: true });
                    break;
                case "play-next":
                    localAudioControls.queue.insertNext(tracksToAdd);
                    break;
                default:
                    localAudioControls.queue.append(tracksToAdd);
                    break;
            }
        },
        [libraryTracks],
    );

    const handleSearchPlaylistSelect = useCallback(
        (playlist: LocalPlaylist) => {
            perfLog("PlaylistSelector.handleSearchPlaylistSelect", { playlistId: playlist.id });

            const { tracks: resolvedTracks, missingPaths } = resolvePlaylistTracks(
                {
                    id: playlist.id,
                    name: playlist.name,
                    trackPaths: playlist.trackPaths,
                },
                localTracks,
                tracksByPath,
            );

            if (resolvedTracks.length > 0) {
                localAudioControls.queue.replace(resolvedTracks, { startIndex: 0, playImmediately: true });
            } else if (playlist.id !== DEFAULT_LOCAL_PLAYLIST_ID) {
                console.warn(`No tracks resolved for playlist ${playlist.name}`);
                localAudioControls.queue.clear();
            }

            if (missingPaths.length > 0) {
                console.warn(`Playlist ${playlist.name} is missing ${missingPaths.length} tracks from the library`);
            }

            setCurrentPlaylist(playlist.id, "file");
        },
        [localTracks, tracksByPath],
    );

    return {
        handlePlaylistSelect,
        handleTrackSelect,
        handleLibraryItemSelect,
        handleSearchPlaylistSelect,
    };
}

export function useLibraryToggle() {
    const isLibraryOpen = use$(libraryUI$.isOpen);

    const toggleLibraryWindow = useCallback(() => {
        perfLog("PlaylistSelector.toggleLibraryWindow", { isOpen: libraryUI$.isOpen.get() });
        libraryUI$.isOpen.set(!libraryUI$.isOpen.get());
    }, []);

    return { isLibraryOpen, toggleLibraryWindow };
}

interface QueueExporterArgs {
    queueTracks: LocalTrack[];
}

export function useQueueExporter({ queueTracks }: QueueExporterArgs) {
    const handleSavePlaylist = useCallback(async () => {
        perfLog("PlaylistSelector.handleSavePlaylist");

        if (queueTracks.length === 0) {
            console.log("No tracks in queue to save");
            return;
        }

        try {
            const m3uContent = generateM3UPlaylist(queueTracks);
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const filename = `Queue-${timestamp}.m3u`;

            const playlistDirectory = getCacheDirectory("playlists");
            ensureCacheDirectory(playlistDirectory);

            const file = new File(playlistDirectory, filename);
            file.create({ overwrite: true, intermediates: true });
            file.write(m3uContent);

            await loadLocalPlaylists();

            console.log(`Playlist saved to cache: ${file.uri}`);
            console.log(`Saved ${queueTracks.length} tracks to playlist`);
        } catch (error) {
            console.error("Failed to save playlist to cache directory:", error);
        }
    }, [queueTracks]);

    return { handleSavePlaylist };
}

export function generateM3UPlaylist(
    tracks: { title: string; artist: string; filePath: string; duration?: string }[],
): string {
    const lines = ["#EXTM3U", ""];

    for (const track of tracks) {
        let durationSeconds = -1;
        if (track.duration) {
            const parts = track.duration.split(":");
            if (parts.length === 2) {
                const minutes = Number.parseInt(parts[0], 10) || 0;
                const seconds = Number.parseInt(parts[1], 10) || 0;
                durationSeconds = minutes * 60 + seconds;
            } else {
                const numeric = Number.parseInt(track.duration, 10);
                if (!Number.isNaN(numeric) && numeric >= 0) {
                    durationSeconds = numeric;
                }
            }
        }

        lines.push(`#EXTINF:${durationSeconds},${track.artist} - ${track.title}`);
        lines.push(track.filePath);
        lines.push("");
    }

    return lines.join("\n");
}

export const selectedPlaylist$ = stateSaved$.playlist;

export type { PlaylistOption };
