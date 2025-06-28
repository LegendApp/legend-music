import { use$, useObservable } from "@legendapp/state/react";
import { synced } from "@legendapp/state/sync";
import { Text, View } from "react-native";
import { Playlist } from "@/components/Playlist";
import { Select } from "@/components/Select";
import { controls, playerState$, type YTMusicPlaylist } from "@/components/YouTubeMusicPlayer";
import { localMusicState$, setCurrentPlaylist } from "@/systems/LocalMusicState";
import { type Playlist as PlaylistType, playlistsData$ } from "@/systems/Playlists";
import { stateSaved$ } from "@/systems/State";

export function PlaylistSelector() {
    const playerState = use$(playerState$);
    const localMusicState = use$(localMusicState$);
    const playlistsObj = use$(playlistsData$.playlists);
    const playlistsArr = Object.values(playlistsObj).sort((playlist) => playlist.order);

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

    // Find currently selected playlist based on currentPlaylistId
    const currentPlaylistId = localMusicState.currentPlaylistId;
    const selectedPlaylist = availablePlaylists.find((playlist) => playlist.id === currentPlaylistId);

    const selectedPlaylist$ = stateSaved$.playlist;
    const selected$ = useObservable<PlaylistType>(
        synced({
            get: () => {
                const id = selectedPlaylist$.get();

                return availablePlaylists.find((playlist) => playlist.id === id);
            },
            set: ({ value }) => {
                selectedPlaylist$.set(value!.id);
            },
        }),
    );

    const handlePlaylistSelect = (playlist: YTMusicPlaylist) => {
        console.log("Navigating to playlist:", playlist.id);
        selectedPlaylist$.set(playlist.id);
        setCurrentPlaylist(playlist.id);

        if (playlist.id === "LOCAL_FILES") {
            // Handle local files selection
            console.log("Selected local files playlist");
        } else {
            // Handle YouTube Music playlists
            controls.navigateToPlaylist(playlist.id);
        }
    };

    return (
        <View className="flex-1">
            {/* Title bar area for playlist */}
            <View className="px-3 py-1 border-t border-white/10">
                <Select
                    items={availablePlaylists}
                    selected$={selected$}
                    placeholder="Local Files"
                    onSelectItem={handlePlaylistSelect}
                    getItemKey={(playlist) => playlist.id}
                    renderItem={(playlist, mode) => {
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

            {/* Playlist content */}
            <View className="flex-1">
                <Playlist />
            </View>
        </View>
    );
}
