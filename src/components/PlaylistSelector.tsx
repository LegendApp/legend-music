import { use$, useObservable } from "@legendapp/state/react";
import { useCallback, useRef } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { DropdownMenu, type DropdownMenuRootRef } from "@/components/DropdownMenu";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import { SelectLegendList } from "@/components/SelectLegendList";
import { StyledInput } from "@/components/StyledInput";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { libraryUI$ } from "@/systems/LibraryState";
import { type LocalTrack, localMusicState$, setCurrentPlaylist } from "@/systems/LocalMusicState";
import { stateSaved$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";

interface LocalPlaylist {
    id: string;
    name: string;
    count: number;
    type: "file";
}

export function PlaylistSelector() {
    perfCount("PlaylistSelector.render");
    const localMusicState = use$(localMusicState$);

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
    const selectedPlaylist = use$(selectedPlaylist$);

    // Search state
    const searchQuery$ = useObservable("");
    const searchQuery = use$(searchQuery$);

    // Dropdown menu ref
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
    };

    const isLocalFilesSelected = selectedPlaylist === "LOCAL_FILES";

    // Filter search results
    const searchResults = searchQuery.trim()
        ? localMusicState.tracks
              .filter(
                  (track) =>
                      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      track.artist.toLowerCase().includes(searchQuery.toLowerCase()),
              )
              .slice(0, 10) // Limit to 10 results
        : [];

    const handleTrackSelect = (track: LocalTrack) => {
        perfLog("PlaylistSelector.handleTrackSelect", { trackId: track.id });
        console.log("Selected track:", track);

        // Find the index of the selected track in the full tracks list
        const trackIndex = localMusicState.tracks.findIndex((t) => t.id === track.id);

        if (trackIndex !== -1) {
            // Load the entire local music library as playlist, starting with the selected track
            localAudioControls.loadPlaylist(localMusicState.tracks, trackIndex);
            console.log(`Started playing "${track.title}" by ${track.artist}`);
        } else {
            // If track not found in main list, play it as a single track
            localAudioControls.loadTrack(track.filePath, track.title, track.artist);
            console.log(`Started playing single track: "${track.title}" by ${track.artist}`);
        }

        searchQuery$.set(""); // Clear search after selection
    };

    useOnHotkeys({
        Search: () => {
            console.log("Opening search menu");
            dropdownMenuRef.current?.open();
        },
    });

    return (
        <View className="px-1 border-t border-b border-white/10">
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
                                    <Text className="text-text-primary group-hover:text-white text-sm font-semibold">
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
                        // showCaret={true}
                        // caretPosition="right"
                        // caretClassName="text-white/70 hover:text-white"
                        maxWidthMatchTrigger={true}
                    />
                </View>
                <DropdownMenu.Root ref={dropdownMenuRef} closeOnSelect={false}>
                    <DropdownMenu.Trigger asChild>
                        <Button icon="magnifyingglass" variant="icon" size="small" className="ml-2 hover:bg-white/10" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                        <StyledInput value$={searchQuery$} placeholder="Search tracks..." className="mb-2" />
                        {/* <View className="p-2">
                                {searchResults.length > 0 && (
                                    <View className="max-h-64">
                                        {searchResults.map((track) => (
                                            <DropdownMenu.Item
                                                key={track.id}
                                                onSelect={() => handleTrackSelect(track)}
                                                className="p-2 hover:bg-white/10 rounded-md"
                                            >
                                                <View className="flex-1">
                                                    <Text className="text-white font-medium text-sm">
                                                        {track.title}
                                                    </Text>
                                                    <Text className="text-white/60 text-xs">
                                                        {track.artist} • {track.duration}
                                                    </Text>
                                                </View>
                                            </DropdownMenu.Item>
                                        ))}
                                    </View>
                                )}
                                {searchQuery.trim() && searchResults.length === 0 && (
                                    <Text className="text-white/60 text-sm p-2">No tracks found</Text>
                                )}
                            </View> */}
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
                <Button
                    icon={isLibraryOpen ? "sidebar.right" : "sidebar.right"}
                    variant="icon"
                    size="small"
                    iconSize={14}
                    onPress={toggleLibraryWindow}
                    className={`ml-2 hover:bg-white/10 ${isLibraryOpen ? "bg-white/15" : ""}`}
                />
            </View>
        </View>
    );
}
