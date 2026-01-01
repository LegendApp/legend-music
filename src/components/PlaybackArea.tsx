import { useValue } from "@legendapp/state/react";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AlbumArt } from "@/components/AlbumArt";
import { audioControls, audioPlayerState$ } from "@/components/AudioPlayer";
import { PlaybackControls } from "@/components/PlaybackControls";
import { PlaybackTimeline } from "@/components/PlaybackTimeline";
import { SpotifySourceBadge } from "@/components/SpotifySourceBadge";
import { OVERLAY_WINDOW_WIDTH_COMPACT } from "@/overlay/OverlayConstants";
import { Icon } from "@/systems/Icon";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { setIsScrubbing } from "@/systems/PlaybackInteractionState";
import { settings$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import { perfCount } from "@/utils/perfLogger";

export type OverlayPlaybackMode = {
    enabled: boolean;
    showControls: boolean;
};

type PlaybackAreaProps = {
    showBorder?: boolean;
    overlayMode?: OverlayPlaybackMode;
};

export function PlaybackArea({ showBorder = true, overlayMode }: PlaybackAreaProps = {}) {
    perfCount("PlaybackArea.render");
    const currentTrack = useValue(audioPlayerState$.currentTrack);
    const isPlaying = useValue(audioPlayerState$.isPlaying);
    const currentLocalTime$ = audioPlayerState$.currentTime;
    const thumbnailVersion = useValue(localMusicState$.thumbnailVersion);
    const handleSlidingStart = useCallback(() => setIsScrubbing(true), []);
    const handleSlidingEnd = useCallback(() => setIsScrubbing(false), []);
    const overlayModeEnabled = overlayMode?.enabled ?? false;
    const [isHovered, setIsHovered] = useState(false);
    const playbackControlsEnabled = useValue(settings$.ui.playbackControlsEnabled) ?? true;
    const showPlaybackControls = playbackControlsEnabled && !overlayModeEnabled;
    const handleHoverIn = useCallback(() => setIsHovered(true), []);
    const handleHoverOut = useCallback(() => setIsHovered(false), []);
    const showTimeline = !overlayModeEnabled;
    const isSpotifyTrack = currentTrack?.provider === "spotify";
    const spotifyBadgeSize = overlayModeEnabled ? 14 : 16;

    // const hoverContentVisible = isHovered && overlayControlsVisible;
    // const hoverContentVisible = isWindowHovered && overlayControlsVisible;

    const sliderRowNode = showTimeline ? (
        <PlaybackTimeline
            currentLocalTime$={currentLocalTime$}
            duration$={audioPlayerState$.duration}
            disabled={!currentTrack}
            onSlidingStart={handleSlidingStart}
            onSlidingComplete={(value) => {
                audioControls.seek(value);
            }}
            onSlidingEnd={handleSlidingEnd}
            overlayMode={overlayMode}
        />
    ) : null;

    // perfLog("PlaybackArea.state", {
    //     track: currentTrack?.title,
    //     isLoading,
    //     isPlaying,
    //     currentTime: currentLocalTime$.peek?.(),
    // });

    return (
        <View
            className={cn("relative px-3", showBorder ? "pt-3" : "py-3", !playbackControlsEnabled && "py-3")}
            mouseDownCanMoveWindow
            onMouseEnter={handleHoverIn}
            onMouseLeave={handleHoverOut}
            data-hovered={isHovered ? "true" : undefined}
        >
            {/* {hoverContentVisible ? (
                <View className="absolute right-0 top-0" pointerEvents="box-none">
                    <PlaylistSelector variant="overlay" />
                </View>
            ) : null} */}
            <View className="flex-row items-start gap-3">
                {/* Album Art */}
                <View className="relative shrink-0">
                    <AlbumArt
                        uri={currentTrack?.thumbnail}
                        reloadKey={thumbnailVersion}
                        size={overlayModeEnabled ? "medium" : "large"}
                        fallbackIcon="♪"
                    />
                    <Pressable
                        className="absolute inset-0 opacity-0 hover:opacity-100 transition-all duration-300 items-center justify-center"
                        onPress={audioControls.togglePlayPause}
                    >
                        <Icon name={isPlaying ? "pause.fill" : "play.fill"} size={24} color="#fff" />
                    </Pressable>
                    {isSpotifyTrack ? (
                        <View className="absolute bottom-1 right-1 opacity-60" pointerEvents="none">
                            <SpotifySourceBadge size={spotifyBadgeSize} />
                        </View>
                    ) : null}
                </View>

                {/* Song Info */}
                <View
                    className={cn(
                        "relative flex-1 flex-col overflow-hidden",
                        overlayModeEnabled && "justify-center h-full",
                    )}
                    style={{ maxWidth: overlayModeEnabled ? OVERLAY_WINDOW_WIDTH_COMPACT - 148 : undefined }}
                >
                    <View className="relative flex-col gap-0.5">
                        <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                            {currentTrack?.title || " "}
                        </Text>
                        <Text className="text-white/70 text-sm" numberOfLines={1}>
                            {currentTrack?.artist || " "}
                        </Text>
                        {sliderRowNode}
                    </View>
                </View>
            </View>
            {showPlaybackControls ? <PlaybackControls className="pt-1 -mx-1 pb-1" /> : null}
        </View>
    );
}
