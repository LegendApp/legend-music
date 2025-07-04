import { use$, useObservable } from "@legendapp/state/react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { DropdownMenu } from "@/components/DropdownMenu";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import { Playlist } from "@/components/Playlist";
import { Select } from "@/components/Select";
import { StyledInput } from "@/components/StyledInput";
import type { YTMusicPlaylist } from "@/components/YouTubeMusicPlayer";
import { type LocalTrack, localMusicState$, setCurrentPlaylist } from "@/systems/LocalMusicState";
import { playlistsData$ } from "@/systems/Playlists";
import { stateSaved$ } from "@/systems/State";

export function PlaylistSelector() {
    const localMusicState = use$(localMusicState$);
    const playlistsObj = use$(playlistsData$.playlistsYtm);
    const playlistsArr = Object.values(playlistsObj).sort((a, b) => a.index! - b.index!);

    // Create local files playlist
    const localFilesPlaylist: YTMusicPlaylist = {
        id: "LOCAL_FILES",
        name: "Local Files",
        thumbnail: "",
        count: localMusicState.tracks.length,
        creator: "Local Library",
        path: "",
        type: "file",
        order: -1,
    };

    // Combine YouTube Music playlists with local files
    const availablePlaylists = [localFilesPlaylist, ...playlistsArr];
    const availablePlaylistIds = availablePlaylists.map((playlist) => playlist.id);

    const selectedPlaylist$ = stateSaved$.playlist;
    const selectedPlaylist = use$(selectedPlaylist$);

    // Search state
    const searchQuery$ = useObservable("");
    const searchQuery = use$(searchQuery$);

    const handlePlaylistSelect = (playlistId: string) => {
        console.log("Navigating to playlist:", playlistId);
        setCurrentPlaylist(playlistId, playlistId === "LOCAL_FILES" ? "file" : "ytm");

        if (playlistId === "LOCAL_FILES") {
            // Handle local files selection
            console.log("Selected local files playlist");
        }
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

    return (
        <View className="flex-1">
            {/* Title bar area for playlist */}
            <View className="px-2 py-1 border-t border-white/10">
                <View className="flex-row items-center">
                    <View className="flex-1">
                        <Select
                            items={availablePlaylistIds}
                            selected$={selectedPlaylist$}
                            placeholder="Local Files"
                            onSelectItem={handlePlaylistSelect}
                            getItemKey={(playlist) => playlist}
                            renderItem={(playlistId, mode) => {
                                if (!playlistId) return <Text>Null</Text>;
                                const playlist =
                                    playlistId === "LOCAL_FILES" ? localFilesPlaylist : playlistsObj[playlistId];

                                if (!playlist) {
                                    console.log("Playlist not found:", playlistId);
                                    return <Text>Null</Text>;
                                }

                                if (mode === "preview") {
                                    return (
                                        <Text className="text-white/90 group-hover:text-white text-base font-semibold">
                                            {playlist.name}
                                        </Text>
                                    );
                                }
                                return (
                                    <View className="flex-row items-center">
                                        <Text className="text-white text-base font-medium flex-1">{playlist.name}</Text>
                                    </View>
                                );
                            }}
                            unstyled={true}
                            showCaret={true}
                            caretPosition="right"
                            triggerClassName="hover:bg-white/10 rounded-md h-8 px-2"
                            caretClassName="text-white/70 hover:text-white"
                            maxWidthMatchTrigger={true}
                        />
                    </View>
                    <DropdownMenu.Root closeOnSelect={false}>
                        <DropdownMenu.Trigger asChild>
                            <Button
                                icon="magnifyingglass"
                                variant="icon"
                                size="medium"
                                className="ml-2 hover:bg-white/10"
                            />
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                            <View className="p-2">
                                <StyledInput value$={searchQuery$} placeholder="Search tracks..." className="mb-2" />
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
                            </View>
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                </View>
            </View>

            {/* Playlist content */}
            <View className="flex-1">
                <Playlist />
            </View>
        </View>
    );
}
