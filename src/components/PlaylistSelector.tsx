import { use$, useObservable } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { Select } from "@/components/Select";
import { type YTMusicPlaylist, controls, playerState$ } from "@/components/YouTubeMusicPlayer";

export function PlaylistSelector() {
    const playerState = use$(playerState$);
    const selectedPlaylist$ = useObservable<YTMusicPlaylist>(undefined);
    const selectedPlaylist = use$(selectedPlaylist$);

    const availablePlaylists = playerState.availablePlaylists;

    const handlePlaylistSelect = (playlist: YTMusicPlaylist) => {
        selectedPlaylist$.set(playlist);
        controls.navigateToPlaylist(playlist.id);
    };

    return (
        <View className="mx-6 mt-4">
            {availablePlaylists.length > 0 ? (
                <Select
                    items={availablePlaylists}
                    selected$={selectedPlaylist$}
                    placeholder="Select a playlist"
                    onSelectItem={handlePlaylistSelect}
                    getItemKey={(playlist) => playlist.id}
                    renderItem={(playlist) => (
                        <View className="flex-row items-center w-80">
                            <Text className="text-white text-base font-medium flex-1">{playlist.title}</Text>
                            {playlist.trackCount !== undefined && (
                                <Text className="text-white/60 text-sm ml-2">{playlist.trackCount} songs</Text>
                            )}
                        </View>
                    )}
                    renderItemText={(playlist) => playlist.title}
                    className="rounded-2xl"
                    triggerClassName="px-6 py-4"
                />
            ) : (
                <View className="bg-white/20 rounded-2xl px-6 py-4 flex-row items-center justify-between">
                    <Text className="text-white text-lg font-medium">
                        {playerState.isLoading ? "Loading playlists..." : "No playlists found"}
                    </Text>
                    <Text className="text-white/70 text-lg">⌄</Text>
                </View>
            )}
        </View>
    );
}
