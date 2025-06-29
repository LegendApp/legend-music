import { LegendList } from "@legendapp/list";
import { use$, useObservable } from "@legendapp/state/react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { controls, playbackState$, playlistState$, playlistsState$ } from "@/components/YouTubeMusicPlayer";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { cn } from "@/utils/cn";

interface PlaylistTrack {
    title: string;
    artist: string;
    duration: string;
    thumbnail: string;
    index: number;
    isPlaying?: boolean;
    isSeparator?: boolean;
    fromSuggestions?: boolean;
}

interface TrackItemProps {
    track: PlaylistTrack;
    index: number;
    currentTrackIndex: number;
    clickedTrackIndex: number | null;
    onTrackClick: (index: number) => void;
}

const TrackItem = ({ track, index, currentTrackIndex, clickedTrackIndex, onTrackClick }: TrackItemProps) => {
    // Handle separator items
    if (track.isSeparator) {
        return (
            <View className="flex-row items-center px-4 py-3 border-t border-white/10 mt-2">
                <Text className="text-white/70 text-sm font-medium text-center flex-1">{track.title}</Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            className={cn(
                "flex-row items-center px-4 py-2",
                index === currentTrackIndex ? "bg-white/10" : clickedTrackIndex === index ? "bg-orange-500/20" : "",
                track.fromSuggestions ? "opacity-80" : "",
            )}
            onPress={() => onTrackClick(index)}
        >
            <Text className={cn("text-base w-8", track.fromSuggestions ? "text-white/40" : "text-white/60")}>
                {track.index >= 0 ? track.index + 1 : ""}
            </Text>

            {track.thumbnail ? (
                <Image source={{ uri: track.thumbnail }} className="size-9 rounded-lg" resizeMode="cover" />
            ) : (
                <View className="w-12 h-12 bg-white/20 rounded-lg ml-4 items-center justify-center">
                    <Text className="text-white text-xs">♪</Text>
                </View>
            )}

            <View className="flex-1 ml-4 mr-8">
                <Text
                    className={cn("text-sm font-medium", track.fromSuggestions ? "text-white/70" : "text-white")}
                    numberOfLines={1}
                >
                    {track.title}
                </Text>
                <Text
                    className={cn("text-sm", track.fromSuggestions ? "text-white/40" : "text-white/50")}
                    numberOfLines={1}
                >
                    {track.artist}
                </Text>
            </View>

            <Text className={cn("text-base", track.fromSuggestions ? "text-white/40" : "text-white/60")}>
                {track.duration}
            </Text>
        </TouchableOpacity>
    );
};

type PlaylistTrackWithSuggestions = PlaylistTrack & {
    fromSuggestions?: true;
    isSeparator?: boolean;
};

export function Playlist() {
    const playbackState = use$(playbackState$);
    const playlistState = use$(playlistState$);
    const playlistsState = use$(playlistsState$);
    const localMusicState = use$(localMusicState$);
    const localPlayerState = use$(localPlayerState$);
    const clickedTrackIndex$ = useObservable<number | null>(null);
    const clickedTrackIndex = use$(clickedTrackIndex$);

    // Determine which playlist to show
    const isLocalFilesSelected = localMusicState.isLocalFilesSelected;
    const playlist: PlaylistTrackWithSuggestions[] = isLocalFilesSelected
        ? localMusicState.tracks.map((track, index) => ({
              title: track.title,
              artist: track.artist,
              duration: track.duration,
              thumbnail: track.thumbnail || "",
              index,
              isPlaying: index === localPlayerState.currentIndex && localPlayerState.isPlaying,
          }))
        : [
              ...playlistState.songs,
              ...(playlistState.suggestions.length > 0
                  ? [
                        // Add a separator item
                        {
                            title: "— Suggestions —",
                            artist: "",
                            duration: "",
                            thumbnail: "",
                            index: -1,
                            isPlaying: false,
                            isSeparator: true,
                        },
                        ...playlistState.suggestions.map((track, index) => ({
                            ...track,
                            index: playlistState.songs.length + index,
                            fromSuggestions: true,
                        })),
                    ]
                  : []),
          ];

    const currentTrackIndex = isLocalFilesSelected ? localPlayerState.currentIndex : playbackState.currentTrackIndex;

    const handleTrackClick = (index: number) => {
        const track = playlist[index];

        // Don't allow clicking on separator items
        if (track?.isSeparator) {
            return;
        }

        clickedTrackIndex$.set(index);

        if (isLocalFilesSelected) {
            // Handle local file playback
            console.log("Playing local file at index:", index);
            const tracks = localMusicState.tracks;
            const localTrack = tracks[index];

            if (localTrack) {
                console.log("Playing:", localTrack.title, "by", localTrack.artist);
                // Load the entire playlist and start playing at the selected index
                localAudioControls.loadPlaylist(tracks, index);
            }
        } else {
            // Handle YouTube Music playback
            // For suggestions, we need to use the actual track index
            const actualIndex = track?.fromSuggestions ? track.index : index;
            controls.playTrackAtIndex(actualIndex);
        }

        // Clear the clicked state after a short delay
        setTimeout(() => {
            clickedTrackIndex$.set(null);
        }, 1000);
    };

    // Check if we have playlists available to show
    const hasAvailablePlaylists = isLocalFilesSelected
        ? localMusicState.tracks.length > 0
        : playlistsState.availablePlaylists.length > 0;

    return (
        <View className="flex-1">
            {playlist.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-white/60 text-base">
                        {isLocalFilesSelected
                            ? localMusicState.isScanning
                                ? `Scanning... ${localMusicState.scanProgress}/${localMusicState.scanTotal}`
                                : localMusicState.error
                                  ? "Error scanning local files"
                                  : "No local MP3 files found"
                            : !hasAvailablePlaylists && playbackState.isLoading
                              ? "Loading playlist..."
                              : hasAvailablePlaylists
                                ? "Select a playlist to view tracks"
                                : "No playlist available"}
                    </Text>
                    <Text className="text-white/40 text-sm mt-2">
                        {isLocalFilesSelected
                            ? "Add MP3 files to /Users/jay/Downloads/mp3"
                            : hasAvailablePlaylists
                              ? "Choose a playlist from the dropdown above"
                              : "Navigate to YouTube Music and play a song"}
                    </Text>
                </View>
            ) : (
                <LegendList
                    data={playlist}
                    keyExtractor={(item, index) => `track-${index}`}
                    contentContainerStyle={styles.container}
                    recycleItems
                    renderItem={({ item: track, index }) => (
                        <TrackItem
                            key={index}
                            track={track}
                            index={index}
                            currentTrackIndex={currentTrackIndex}
                            clickedTrackIndex={clickedTrackIndex}
                            onTrackClick={handleTrackClick}
                        />
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 4,
    },
});
