import { use$ } from "@legendapp/state/react";
import { File } from "expo-file-system/next";
import { useCallback, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import type { DropdownMenuRootRef } from "@/components/DropdownMenu";
import { localAudioControls, queue$ } from "@/components/LocalAudioPlayer";
import { PlaylistSelectorSearchDropdown } from "@/components/PlaylistSelectorSearchDropdown";
import { SelectLegendList } from "@/components/SelectLegendList";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import type { LibraryItem } from "@/systems/LibraryState";
import { library$, libraryUI$ } from "@/systems/LibraryState";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { loadLocalPlaylists, localMusicState$, setCurrentPlaylist } from "@/systems/LocalMusicState";
import { stateSaved$ } from "@/systems/State";
import { showSaveDialog } from "@/native-modules/FileDialog";
import { ensureCacheDirectory, getCacheDirectory } from "@/utils/cacheDirectories";
import { perfCount, perfLog } from "@/utils/perfLogger";

function generateM3UPlaylist(tracks: { title: string; artist: string; filePath: string; duration?: string }[]): string {
    const lines = ["#EXTM3U", ""];

    for (const track of tracks) {
        // Parse duration to seconds for M3U format
        let durationSeconds = -1;
        if (track.duration) {
            const parts = track.duration.split(":");
            if (parts.length === 2) {
                const minutes = Number.parseInt(parts[0], 10) || 0;
                const seconds = Number.parseInt(parts[1], 10) || 0;
                durationSeconds = minutes * 60 + seconds;
            }
        }

        // Add extended info line
        lines.push(`#EXTINF:${durationSeconds},${track.artist} - ${track.title}`);
        // Add file path
        lines.push(track.filePath);
        lines.push("");
    }

    return lines.join("\n");
}

interface PlaylistOption {
    id: string;
    name: string;
    count: number;
    type: "local-files" | "saved";
    trackPaths?: string[];
}

export function PlaylistSelector() {
    perfCount("PlaylistSelector.render");
    const localMusicState = use$(localMusicState$);
    const library = use$(library$);
    const queue = use$(queue$);

    const localFilesPlaylist = useMemo<PlaylistOption>(
        () => ({
            id: "LOCAL_FILES",
            name: "Local Files",
            count: localMusicState.tracks.length,
            type: "local-files",
        }),
        [localMusicState.tracks.length],
    );

    const savedPlaylistOptions = useMemo<PlaylistOption[]>(
        () =>
            localMusicState.playlists.map((playlist) => ({
                id: playlist.id,
                name: playlist.name,
                count: playlist.trackCount,
                type: "saved",
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

    const selectedPlaylist$ = stateSaved$.playlist;

    const dropdownMenuRef = useRef<DropdownMenuRootRef>(null);
    const isLibraryOpen = use$(libraryUI$.isOpen);

    const toggleLibraryWindow = useCallback(() => {
        perfLog("PlaylistSelector.toggleLibraryWindow", { isOpen: libraryUI$.isOpen.get() });
        libraryUI$.isOpen.set(!libraryUI$.isOpen.get());
    }, []);

    const tracksByPath = useMemo(
        () => new Map(localMusicState.tracks.map((track) => [track.filePath, track])),
        [localMusicState.tracks],
    );

    const handlePlaylistSelect = (playlistId: string) => {
        perfLog("PlaylistSelector.handlePlaylistSelect", { playlistId });
        const playlist = playlistMap.get(playlistId);

        if (!playlist) {
            console.warn("Playlist not found:", playlistId);
            return;
        }

        console.log("Navigating to playlist:", playlistId, playlist.name);

        if (playlist.type === "local-files") {
            const tracks = localMusicState.tracks;
            if (tracks.length > 0) {
                localAudioControls.queue.replace(tracks, { startIndex: 0, playImmediately: true });
            } else {
                localAudioControls.queue.clear();
            }
        } else {
            const trackPaths = playlist.trackPaths ?? [];
            const resolvedTracks = trackPaths
                .map((path) => tracksByPath.get(path))
                .filter((track): track is LocalTrack => track !== undefined);

            if (resolvedTracks.length > 0) {
                localAudioControls.queue.replace(resolvedTracks, { startIndex: 0, playImmediately: true });
            } else {
                console.warn(`No tracks resolved for playlist ${playlist.name}`);
                localAudioControls.queue.clear();
            }

            const missingCount = trackPaths.length - resolvedTracks.length;
            if (missingCount > 0) {
                console.warn(`Playlist ${playlist.name} is missing ${missingCount} tracks from the library`);
            }
        }

        setCurrentPlaylist(playlistId, "file");
    };

    const handleTrackSelect = (track: LocalTrack, action: "enqueue" | "play-next") => {
        perfLog("PlaylistSelector.handleTrackSelect", { trackId: track.id, action });
        console.log("Selected track:", track, "action:", action);

        if (action === "play-next") {
            localAudioControls.queue.insertNext(track);
            return;
        }

        localAudioControls.queue.append(track);
    };

    const handleLibraryItemSelect = (item: LibraryItem, action: "enqueue" | "play-next") => {
        perfLog("PlaylistSelector.handleLibraryItemSelect", { itemId: item.id, type: item.type, action });
        console.log("Selected library item:", item, "action:", action);

        // Get tracks for the selected item
        let tracksToAdd: LocalTrack[] = [];

        if (item.type === "album") {
            tracksToAdd = library.tracks.filter((track) => track.album === item.name);
        } else if (item.type === "artist") {
            tracksToAdd = library.tracks.filter((track) => track.artist === item.name);
        }

        if (tracksToAdd.length === 0) {
            return;
        }

        if (action === "play-next") {
            localAudioControls.queue.insertNext(tracksToAdd);
            return;
        }

        localAudioControls.queue.append(tracksToAdd);
    };

    const handleSaveQueue = useCallback(async () => {
        perfLog("PlaylistSelector.handleSaveQueue");

        if (queue.tracks.length === 0) {
            console.log("No tracks in queue to save");
            return;
        }

        try {
            const m3uContent = generateM3UPlaylist(queue.tracks);
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const filename = `Queue-${timestamp}.m3u`;

            const playlistDirectory = getCacheDirectory("playlists");
            ensureCacheDirectory(playlistDirectory);

            const defaultDirectoryUri = playlistDirectory.uri;
            const defaultDirectoryPath = defaultDirectoryUri.startsWith("file://")
                ? new URL(defaultDirectoryUri).pathname
                : defaultDirectoryUri;

            const savePath = await showSaveDialog({
                defaultName: filename,
                directory: defaultDirectoryPath,
                allowedFileTypes: ["m3u", "m3u8"],
            });

            if (!savePath) {
                console.log("Save queue cancelled by user");
                return;
            }

            const file = new File(savePath);
            file.create({ overwrite: true, intermediates: true });
            file.write(m3uContent);

            await loadLocalPlaylists();

            console.log(`Playlist saved to: ${file.uri}`);
            console.log(`Saved ${queue.tracks.length} tracks to playlist`);
        } catch (error) {
            console.error("Failed to save queue as playlist:", error);
        }
    }, [queue.tracks]);

    useOnHotkeys({
        Search: () => {
            console.log("Opening search menu");
            dropdownMenuRef.current?.open();
        },
    });

    return (
        <View className="px-1 border-t border-white/10">
            <View className="flex-row items-center">
                <View className="flex-1">
                    <SelectLegendList
                        items={availablePlaylistIds}
                        selected$={selectedPlaylist$}
                        placeholder="Local Files"
                        onSelectItem={handlePlaylistSelect}
                        getItemKey={(playlist) => playlist}
                        renderItem={(playlistId, mode) => {
                            if (!playlistId) return <Text>Null</Text>;
                            const playlist = playlistMap.get(playlistId);

                            if (!playlist) {
                                console.log("Playlist not found:", playlistId);
                                return <Text>Null</Text>;
                            }

                            if (mode === "preview") {
                                return (
                                    <Text className="text-text-secondary group-hover:text-white text-sm">
                                        {playlist.name}
                                    </Text>
                                );
                            }
                            return (
                                <View className="flex-row items-center justify-between gap-3">
                                    <Text className="text-text-primary text-sm font-medium flex-1">
                                        {playlist.name}
                                    </Text>
                                    <Text className="text-text-secondary text-xs">
                                        {playlist.count} {playlist.count === 1 ? "track" : "tracks"}
                                    </Text>
                                </View>
                            );
                        }}
                        unstyled={true}
                        triggerClassName="hover:bg-white/10 rounded-md h-8 px-2"
                        directionalHint="topLeftEdge"
                        // showCaret={true}
                        // caretPosition="right"
                        // caretClassName="text-white/70 hover:text-white"
                        maxWidthMatchTrigger={true}
                    />
                </View>
                <PlaylistSelectorSearchDropdown
                    ref={dropdownMenuRef}
                    tracks={localMusicState.tracks}
                    onSelectTrack={handleTrackSelect}
                    onSelectLibraryItem={handleLibraryItemSelect}
                />
                <Button
                    icon="square.and.arrow.down"
                    variant="icon"
                    size="small"
                    iconSize={14}
                    onClick={handleSaveQueue}
                    className="ml-2 hover:bg-white/10"
                    disabled={queue.tracks.length === 0}
                    tooltip="Save queue"
                />
                <Button
                    icon={isLibraryOpen ? "sidebar.right" : "sidebar.right"}
                    variant="icon"
                    size="small"
                    iconSize={14}
                    onClick={toggleLibraryWindow}
                    className={`ml-2 hover:bg-white/10 ${isLibraryOpen ? "bg-white/15" : ""}`}
                    tooltip={isLibraryOpen ? "Hide library" : "Show library"}
                />
            </View>
        </View>
    );
}
