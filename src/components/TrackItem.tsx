import type { Observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { Text, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";
import { Button } from "@/components/Button";
import { localPlayerState$ } from "@/components/LocalAudioPlayer";
import { PlaybackIndicator } from "@/components/PlaybackIndicator";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { Icon } from "@/systems/Icon";
import { themeState$ } from "@/theme/ThemeProvider";
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
    queueEntryId?: string;
    isMissing?: boolean;
}

interface TrackItemProps {
    track: TrackData;
    index: number;
    showIndex?: boolean;
    showAlbumArt?: boolean;
    isSelected?: boolean;
    selectedIndices$?: Observable<Set<number>>;
    onClick?: (index: number, event?: NativeMouseEvent) => void;
    onDoubleClick?: (index: number, event?: NativeMouseEvent) => void;
    onRightClick?: (index: number, event: NativeMouseEvent) => void;
    onMouseDown?: (index: number, event: NativeMouseEvent) => void;
    disableHover?: boolean;
    suppressActiveState?: boolean;
}

export const TrackItem = ({
    track,
    index,
    showIndex = true,
    selectedIndices$,
    onClick,
    onDoubleClick,
    onRightClick,
    onMouseDown,
    disableHover = false,
    suppressActiveState = false,
}: TrackItemProps) => {
    perfCount("TrackItem.render");
    const listItemStyles = useListItemStyles();
    const accentColor = useValue(() => themeState$.customColors.dark.accent.primary.get());

    const trackIsPlayingFlag = track.isPlaying;
    const trackQueueEntryId = track.queueEntryId;
    const isMissing = !!track.isMissing;
    const isPlaying = useValue(() => {
        if (typeof trackIsPlayingFlag === "boolean") {
            return trackIsPlayingFlag;
        }

        const currentTrack = localPlayerState$.currentTrack.get();
        if (!currentTrack) {
            return false;
        }

        const currentQueueEntryId = (currentTrack as { queueEntryId?: string }).queueEntryId;
        if (trackQueueEntryId && currentQueueEntryId) {
            return currentQueueEntryId === trackQueueEntryId;
        }

        return currentTrack.id === track.id;
    });

    const isSelected = useValue(() => {
        const currentSelection = selectedIndices$?.get();
        return currentSelection ? currentSelection.has(index) : false;
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

    const handleRightClick = (event: NativeMouseEvent) => {
        if (!onRightClick) {
            return;
        }

        onRightClick(index, event);
    };

    // Compact mode: single line format "${number}. ${artist} - ${song}"
    // if (playlistStyle === "compact") {
    const rowClassName = cn(
        listItemStyles.getRowClassName({
            variant: "compact",
            isActive: !suppressActiveState && isPlaying,
            isSelected,
            isInteractive: !disableHover && !isMissing,
        }),
        track.fromSuggestions ? "opacity-75" : "",
        isMissing ? "opacity-50" : "",
        "w-full",
    );
    const indexTone = track.fromSuggestions || isMissing ? listItemStyles.text.muted : listItemStyles.text.secondary;
    const primaryTone =
        track.fromSuggestions || isMissing ? listItemStyles.text.secondary : listItemStyles.text.primary;
    const durationTone = track.fromSuggestions || isMissing ? listItemStyles.text.muted : "";
    const trackIndex = track.index ?? index;
    const showDisplayIndex = trackIndex >= 0;

    return (
        <Button
            className={rowClassName}
            onClick={onClick ? (event) => onClick(index, event) : undefined}
            onDoubleClick={onDoubleClick ? (event) => onDoubleClick(index, event) : undefined}
            onRightClick={handleRightClick}
            onMouseDown={onMouseDown ? (event) => onMouseDown(index, event) : undefined}
        >
            {isPlaying ? <PlaybackIndicator /> : null}
            {showIndex && (
                <View className="min-w-7">
                    {showDisplayIndex ? (
                        <Text className={cn("tabular-nums text-xs", indexTone, isPlaying && "text-accent-primary")}>
                            {trackIndex + 1}.
                        </Text>
                    ) : null}
                </View>
            )}
            <Text className={cn("flex-1 tabular-nums text-sm", primaryTone)} numberOfLines={1}>
                <Text
                    className={cn(
                        "text-sm font-medium",
                        listItemStyles.text.primary,
                        isPlaying && "text-accent-primary",
                    )}
                >
                    {track.artist}
                </Text>
                <Text
                    className={cn(
                        "text-sm",
                        listItemStyles.text.secondary,
                        isPlaying && "text-accent-primary opacity-90",
                    )}
                >
                    {" "}
                    - {track.title}
                </Text>
            </Text>

            <Text
                className={cn(
                    listItemStyles.getMetaClassName({
                        className: cn(
                            "text-xs ml-4",
                            track.fromSuggestions ? listItemStyles.text.muted : "",
                            durationTone,
                        ),
                    }),
                    isPlaying && "text-accent-primary",
                )}
            >
                {track.duration}
            </Text>
        </Button>
    );
    // }
};
