import { LegendList } from "@legendapp/list";
import { use$, useSelector } from "@legendapp/state/react";
import { StyleSheet, Text, View } from "react-native";

import { AlbumArt } from "@/components/AlbumArt";
import { Button } from "@/components/Button";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";

interface PlaylistTrack {
    id: string;
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
    // currentTrackIndex: number;
    // clickedTrackIndex: number | null;
    onTrackClick: (index: number) => void;
}

const TrackItem = ({ track, index, onTrackClick }: TrackItemProps) => {
    const localPlayerState = use$(localPlayerState$);
    const playlistStyle = use$(settings$.general.playlistStyle);

    const isPlaying = useSelector(() => {
        const currentTrack = localPlayerState$.currentTrack.get();
        return currentTrack === track || currentTrack?.id === track.id;
    });

    // Handle separator items
    if (track.isSeparator) {
        return (
            <View className="flex-row items-center px-4 py-4 mt-6 mb-2">
                <View className="flex-1 h-px bg-white/15" />
                <Text className="text-white/90 text-xs font-semibold tracking-wider uppercase mx-4 bg-white/5 px-3 py-1.5 rounded-full border border-white/15">
                    {track.title.replace(/^— (.+) —$/, "$1")}
                </Text>
                <View className="flex-1 h-px bg-white/15" />
            </View>
        );
    }

    // Compact mode: single line format "${number}. ${artist} - ${song}"
    if (playlistStyle === "compact") {
        return (
            <Button
                className={cn(
                    "flex-row items-center px-3 py-1",
                    // Playing state styling
                    isPlaying ? "bg-blue-500/20 border-blue-400/30" : "",
                    "hover:bg-white/10 active:bg-white/15 border border-transparent hover:border-white/10",
                    // Suggestions styling
                    track.fromSuggestions ? "opacity-75" : "",
                )}
                onPress={() => onTrackClick(index)}
            >
                <View className="min-w-7">
                    <Text className="tabular-nums text-text-tertiary text-sm">
                        {track.index >= 0 ? `${track.index + 1}.  ` : ""}
                    </Text>
                </View>
                <Text
                    className={cn(
                        "flex-1 tabular-nums min-w-32 text-sm",
                        track.fromSuggestions ? "text-white/70" : "text-text-primary",
                    )}
                    numberOfLines={1}
                >
                    <Text className="text-text-primary font-medium">{track.artist}</Text>
                    <Text className="text-text-secondary text-sm"> - {track.title}</Text>
                </Text>

                <Text className={cn("text-xs ml-4", track.fromSuggestions ? "text-white/40" : "text-text-tertiary")}>
                    {track.duration}
                </Text>
            </Button>
        );
    }

    // Comfortable mode: current existing layout
    return (
        <Button
            className={cn(
                "flex-row items-center px-3 py-1",
                // Playing state styling
                isPlaying ? "bg-blue-500/20 border-blue-400/30" : "",
                "hover:bg-white/10 active:bg-white/15 border border-transparent hover:border-white/10",
                // Suggestions styling
                track.fromSuggestions ? "opacity-75" : "",
            )}
            onPress={() => onTrackClick(index)}
        >
            <Text className={cn("text-base w-8", track.fromSuggestions ? "text-white/40" : "text-white/60")}>
                {track.index >= 0 ? track.index + 1 : ""}
            </Text>

            <AlbumArt
                uri={track.thumbnail}
                size="medium"
                fallbackIcon="♪"
                className={track.fromSuggestions ? "opacity-75" : ""}
            />

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
        </Button>
    );
};

type PlaylistTrackWithSuggestions = PlaylistTrack & {
    fromSuggestions?: true;
    isSeparator?: boolean;
};

export function Playlist() {
    const localMusicState = use$(localMusicState$);
    const localPlayerState = use$(localPlayerState$);
    const playlistStyle = use$(settings$.general.playlistStyle);

    // Only show local files playlist
    const playlist: PlaylistTrackWithSuggestions[] = localMusicState.tracks.map((track, index) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        thumbnail: track.thumbnail || "",
        index,
        isPlaying: index === localPlayerState.currentIndex && localPlayerState.isPlaying,
    }));

    const handleTrackClick = (index: number) => {
        const track = playlist[index];

        // Don't allow clicking on separator items
        if (track?.isSeparator) {
            return;
        }

        // Handle local file playback
        console.log("Playing local file at index:", index);
        const tracks = localMusicState.tracks;
        const localTrack = tracks[index];

        if (localTrack) {
            console.log("Playing:", localTrack.title, "by", localTrack.artist);
            // Load the entire playlist and start playing at the selected index
            localAudioControls.loadPlaylist(tracks, index);
        }
    };

    return (
        <View className="flex-1">
            {playlist.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-white/60 text-base">
                        {localMusicState.isScanning
                            ? `Scanning... ${localMusicState.scanProgress}/${localMusicState.scanTotal}`
                            : localMusicState.error
                              ? "Error scanning local files"
                              : "No local MP3 files found"}
                    </Text>
                    <Text className="text-white/40 text-sm mt-2">
                        Add MP3 files to /Users/jay/Downloads/mp3
                    </Text>
                </View>
            ) : (
                <LegendList
                    data={playlist}
                    keyExtractor={(item, index) => `track-${item.id ?? index}`}
                    contentContainerStyle={styles.container}
                    waitForInitialLayout={false}
                    estimatedItemSize={playlistStyle === "compact" ? 30 : 50}
                    recycleItems
                    renderItem={({ item: track, index }) => (
                        <TrackItem track={track} index={index} onTrackClick={handleTrackClick} />
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
