import { use$ } from "@legendapp/state/react";
import { File } from "expo-file-system/next";
import { useCallback, useRef } from "react";
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
import { localMusicState$, setCurrentPlaylist } from "@/systems/LocalMusicState";
import { stateSaved$ } from "@/systems/State";
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

interface LocalPlaylist {
    id: string;
    name: string;
    count: number;
    type: "file";
}

export function PlaylistSelector() {
    perfCount("PlaylistSelector.render");
    const localMusicState = use$(localMusicState$);
    const library = use$(library$);
    const queue = use$(queue$);

    // Create local files playlist
    const localFilesPlaylist: LocalPlaylist = {
        id: "LOCAL_FILES",
        name: "Local Files",
        count: localMusicState.tracks.length,
        type: "file",
    };

    // Only use local files playlist
    const availablePlaylists = [localFilesPlaylist];
    const availablePlaylistIds = availablePlaylists.map((playlist) => playlist.id);

    const selectedPlaylist$ = stateSaved$.playlist;

    const dropdownMenuRef = useRef<DropdownMenuRootRef>(null);
    const isLibraryOpen = use$(libraryUI$.isOpen);

    const toggleLibraryWindow = useCallback(() => {
        perfLog("PlaylistSelector.toggleLibraryWindow", { isOpen: libraryUI$.isOpen.get() });
        libraryUI$.isOpen.set(!libraryUI$.isOpen.get());
    }, []);

    const handlePlaylistSelect = (playlistId: string) => {
        perfLog("PlaylistSelector.handlePlaylistSelect", { playlistId });
        console.log("Navigating to playlist:", playlistId);
        setCurrentPlaylist(playlistId, "file");
        console.log("Selected local files playlist");

        if (playlistId === "LOCAL_FILES") {
            const tracks = localMusicState.tracks;
            if (tracks.length > 0) {
                localAudioControls.queue.replace(tracks, { startIndex: 0, playImmediately: true });
            } else {
                localAudioControls.queue.clear();
            }
        }
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
            // Generate M3U playlist content
            const m3uContent = generateM3UPlaylist(queue.tracks);

            // Create a filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const filename = `Queue-${timestamp}.m3u`;

            // Use Downloads directory
            const downloadsPath = "/Users/jay/Downloads";
            const file = new File(downloadsPath, filename);

            // Write the playlist file
            file.create({ overwrite: true });
            file.write(m3uContent);

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
                            const playlist = playlistId === "LOCAL_FILES" ? localFilesPlaylist : null;

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
                                <View className="flex-row items-center">
                                    <Text className="text-text-primary text-sm font-medium flex-1">
                                        {playlist.name}
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
                />
                <Button
                    icon={isLibraryOpen ? "sidebar.right" : "sidebar.right"}
                    variant="icon"
                    size="small"
                    iconSize={14}
                    onClick={toggleLibraryWindow}
                    className={`ml-2 hover:bg-white/10 ${isLibraryOpen ? "bg-white/15" : ""}`}
                />
            </View>
        </View>
    );
}
