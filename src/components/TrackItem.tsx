import { use$, useSelector } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { AlbumArt } from "@/components/AlbumArt";
import { Button } from "@/components/Button";
import { localPlayerState$ } from "@/components/LocalAudioPlayer";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { settings$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import { perfCount } from "@/utils/perfLogger";

export interface TrackData {
    id: string;
    title: string;
    artist: string;
    duration: string;
    thumbnail?: string;
    album?: string;
    index?: number;
    isPlaying?: boolean;
    isSeparator?: boolean;
    fromSuggestions?: boolean;
}

interface TrackItemProps {
    track: TrackData;
    index: number;
    onTrackClick: (index: number) => void;
    showIndex?: boolean;
    showAlbumArt?: boolean;
}

export const TrackItem = ({ track, index, onTrackClick, showIndex = true, showAlbumArt = true }: TrackItemProps) => {
    perfCount("TrackItem.render");
    const playlistStyle = use$(settings$.general.playlistStyle);
    const listItemStyles = useListItemStyles();

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
        const rowClassName = cn(
            listItemStyles.getRowClassName({ variant: "compact", isActive: isPlaying }),
            track.fromSuggestions ? "opacity-75" : "",
        );
        const indexTone = track.fromSuggestions ? listItemStyles.text.muted : listItemStyles.text.secondary;
        const primaryTone = track.fromSuggestions ? listItemStyles.text.secondary : listItemStyles.text.primary;
        return (
            <Button className={rowClassName} onPress={() => onTrackClick(index)}>
                {showIndex && (
                    <View className="min-w-7">
                        <Text className={cn("tabular-nums text-sm", indexTone)}>
                            {(track.index ?? index) >= 0 ? `${(track.index ?? index) + 1}.  ` : ""}
                        </Text>
                    </View>
                )}
                <Text className={cn("flex-1 tabular-nums min-w-32 text-sm", primaryTone)} numberOfLines={1}>
                    <Text className={cn("text-sm font-medium", listItemStyles.text.primary)}>{track.artist}</Text>
                    <Text className={cn("text-sm", listItemStyles.text.secondary)}> - {track.title}</Text>
                </Text>

                <Text
                    className={listItemStyles.getMetaClassName({
                        className: cn("text-xs ml-4", track.fromSuggestions ? listItemStyles.text.muted : ""),
                    })}
                >
                    {track.duration}
                </Text>
            </Button>
        );
    }

    // Comfortable mode: current existing layout
    const rowClassName = cn(
        listItemStyles.getRowClassName({ isActive: isPlaying }),
        track.fromSuggestions ? "opacity-75" : "",
    );
    const indexTone = track.fromSuggestions ? listItemStyles.text.muted : listItemStyles.text.secondary;
    const titleTone = track.fromSuggestions ? listItemStyles.text.secondary : listItemStyles.text.primary;
    const subtitleTone = track.fromSuggestions ? listItemStyles.text.muted : listItemStyles.text.secondary;
    return (
        <Button className={rowClassName} onPress={() => onTrackClick(index)}>
            {showIndex && (
                <Text className={cn("text-base w-8", indexTone)}>
                    {(track.index ?? index) >= 0 ? (track.index ?? index) + 1 : ""}
                </Text>
            )}

            {showAlbumArt && (
                <AlbumArt
                    uri={track.thumbnail}
                    size="medium"
                    fallbackIcon="♪"
                    className={track.fromSuggestions ? "opacity-75" : ""}
                />
            )}

            <View className={cn("flex-1 mr-8", showAlbumArt ? "ml-4" : showIndex ? "ml-2" : "")}>
                <Text className={cn("text-sm font-medium", titleTone)} numberOfLines={1}>
                    {track.title}
                </Text>
                <Text className={cn("text-sm", subtitleTone)} numberOfLines={1}>
                    {track.album ? `${track.artist} • ${track.album}` : track.artist}
                </Text>
            </View>

            <Text
                className={listItemStyles.getMetaClassName({
                    className: cn("text-base", track.fromSuggestions ? listItemStyles.text.muted : ""),
                })}
            >
                {track.duration}
            </Text>
        </Button>
    );
};
