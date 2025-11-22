import type { Observable } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import { memo, useCallback, useEffect } from "react";
import { type LayoutChangeEvent, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { AlbumArt } from "@/components/AlbumArt";
import { Button } from "@/components/Button";
import { CustomSlider } from "@/components/CustomSlider";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { SkiaText } from "@/components/SkiaText";
import { usePlaybackControlLayout } from "@/hooks/useUIControls";
import {
    OVERLAY_CONTENT_SPRING_DAMPING,
    OVERLAY_CONTENT_SPRING_MASS,
    OVERLAY_CONTENT_SPRING_REST_DISPLACEMENT,
    OVERLAY_CONTENT_SPRING_REST_SPEED,
    OVERLAY_CONTENT_SPRING_STIFFNESS,
    OVERLAY_WINDOW_WIDTH_COMPACT,
} from "@/overlay/OverlayConstants";
import { setIsScrubbing } from "@/systems/PlaybackInteractionState";
import { type PlaybackControlId, settings$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import { perfCount } from "@/utils/perfLogger";

type OverlayPlaybackMode = {
    enabled: boolean;
    showControls: boolean;
};

type PlaybackAreaProps = {
    showBorder?: boolean;
    overlayMode?: OverlayPlaybackMode;
};

const DEFAULT_PLAYBACK_BUTTONS: PlaybackControlId[] = ["playPause", "next"];

// Format time for local playback with caching to reduce computation
const formatTimeCache = new Map<number, string>();

const CurrentTime = memo(function CurrentTime({ currentLocalTime$ }: { currentLocalTime$: Observable<number> }) {
    const formattedTime$ = useObservable(formatTime(currentLocalTime$.get?.() ?? 0, false));

    useEffect(() => {
        const unsubscribe = currentLocalTime$.onChange(({ value }) => {
            formattedTime$.set(formatTime(value ?? 0, false));
        });

        return () => unsubscribe();
    }, [currentLocalTime$, formattedTime$]);

    return <SkiaText text$={formattedTime$} fontSize={12} color="#ffffffb3" width={36} />;
});

const CurrentDuration = memo(function CurrentDuration() {
    const duration$ = useObservable(formatTime(localPlayerState$.duration.get?.() ?? 0, true));

    useEffect(() => {
        const unsubscribe = localPlayerState$.duration.onChange(({ value }) => {
            duration$.set(formatTime(value ?? 0, true));
        });

        return () => unsubscribe();
    }, [duration$]);

    return <SkiaText text$={duration$} fontSize={12} color="#ffffffb3" width={36} align="right" />;
});

function formatTime(seconds: number, cache?: boolean): string {
    // Round to nearest second for caching efficiency
    const roundedSeconds = Math.floor(seconds);

    if (cache && formatTimeCache.has(roundedSeconds)) {
        return formatTimeCache.get(roundedSeconds)!;
    }

    const mins = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;

    // Cache the result (limit cache size to prevent memory leaks)
    if (cache) {
        if (formatTimeCache.size > 1000) {
            formatTimeCache.clear();
        }
        formatTimeCache.set(roundedSeconds, formatted);
    }

    return formatted;
}

export function PlaybackArea({ showBorder = true, overlayMode }: PlaybackAreaProps = {}) {
    perfCount("PlaybackArea.render");
    const currentTrack = use$(localPlayerState$.currentTrack);
    const isPlaying = use$(localPlayerState$.isPlaying);
    const currentLocalTime$ = localPlayerState$.currentTime;
    const playbackControlsLayout = usePlaybackControlLayout();
    const shuffleEnabled = use$(settings$.playback.shuffle);
    const repeatMode = use$(settings$.playback.repeatMode);
    const handleSlidingStart = useCallback(() => setIsScrubbing(true), []);
    const handleSlidingEnd = useCallback(() => setIsScrubbing(false), []);
    const overlayModeEnabled = overlayMode?.enabled ?? false;
    const overlayControlsVisible = overlayModeEnabled ? (overlayMode?.showControls ?? false) : true;
    const overlayControlsProgress = useSharedValue(overlayControlsVisible ? 1 : 0);
    const sliderRowHeight = useSharedValue(0);

    useEffect(() => {
        if (!overlayModeEnabled) {
            overlayControlsProgress.value = 1;
            return;
        }

        overlayControlsProgress.value = withSpring(overlayControlsVisible ? 1 : 0, {
            damping: OVERLAY_CONTENT_SPRING_DAMPING,
            stiffness: OVERLAY_CONTENT_SPRING_STIFFNESS,
            mass: OVERLAY_CONTENT_SPRING_MASS,
            restDisplacementThreshold: OVERLAY_CONTENT_SPRING_REST_DISPLACEMENT,
            restSpeedThreshold: OVERLAY_CONTENT_SPRING_REST_SPEED,
        });
    }, [overlayControlsVisible, overlayModeEnabled, overlayControlsProgress]);

    const controlsAnimatedStyle = useAnimatedStyle(() => {
        const rawProgress = overlayModeEnabled ? overlayControlsProgress.value : 1;
        const clampedProgress = Math.min(Math.max(rawProgress * 1.1, 0), 1);
        return {
            opacity: clampedProgress,
        };
    });

    const sliderAnimatedStyle = useAnimatedStyle(() => {
        const rawProgress = overlayModeEnabled ? overlayControlsProgress.value : 1;
        const clampedProgress = Math.min(Math.max(rawProgress * 1.1, 0), 1);
        const measuredHeight = sliderRowHeight.value;
        return {
            opacity: clampedProgress,
            height: measuredHeight === 0 ? undefined : measuredHeight * clampedProgress,
        };
    });

    const playbackControlsNode = (
        <View className="flex-row items-center ml-1 -mr-1">
            {(
                (playbackControlsLayout?.shown?.length
                    ? playbackControlsLayout.shown
                    : DEFAULT_PLAYBACK_BUTTONS) as PlaybackControlId[]
            ) // Ensure default buttons when no layout present
                .filter((controlId, index, array) => array.indexOf(controlId) === index)
                .map((controlId) => {
                    switch (controlId) {
                        case "previous":
                            return (
                                <Button
                                    key="previous"
                                    icon="backward.end.fill"
                                    variant="icon"
                                    iconSize={16}
                                    size="small"
                                    iconMarginTop={-1}
                                    onClick={localAudioControls.playPrevious}
                                    tooltip="Previous"
                                    className="mx-0.5"
                                />
                            );
                        case "playPause":
                            return (
                                <Button
                                    key="playPause"
                                    icon={isPlaying ? "pause.fill" : "play.fill"}
                                    variant="icon"
                                    iconSize={16}
                                    size="small"
                                    iconMarginTop={-1}
                                    onClick={localAudioControls.togglePlayPause}
                                    tooltip={isPlaying ? "Pause" : "Play"}
                                    className="mx-0.5"
                                />
                            );
                        case "next":
                            return (
                                <Button
                                    key="next"
                                    icon="forward.end.fill"
                                    variant="icon"
                                    iconSize={16}
                                    size="small"
                                    iconMarginTop={-1}
                                    onClick={localAudioControls.playNext}
                                    tooltip="Next"
                                    className="mx-0.5"
                                />
                            );
                        case "shuffle":
                            return (
                                <Button
                                    key="shuffle"
                                    icon="shuffle"
                                    variant="icon"
                                    iconSize={16}
                                    size="small"
                                    iconMarginTop={-1}
                                    onClick={localAudioControls.toggleShuffle}
                                    tooltip={shuffleEnabled ? "Disable shuffle" : "Enable shuffle"}
                                    className={cn("mx-0.5", shuffleEnabled && "bg-white/15")}
                                />
                            );
                        case "repeat": {
                            const repeatIcon = repeatMode === "one" ? "repeat.1" : "repeat";
                            const repeatTooltip =
                                repeatMode === "off"
                                    ? "Enable repeat"
                                    : repeatMode === "all"
                                      ? "Repeat all tracks"
                                      : "Repeat current track";

                            return (
                                <Button
                                    key="repeat"
                                    icon={repeatIcon}
                                    variant="icon"
                                    iconSize={16}
                                    size="small"
                                    iconMarginTop={-1}
                                    onClick={localAudioControls.cycleRepeatMode}
                                    tooltip={repeatTooltip}
                                    className={cn("mx-0.5", repeatMode !== "off" && "bg-white/15")}
                                />
                            );
                        }
                        default:
                            return null;
                    }
                })}
        </View>
    );

    const handleSliderRowLayout = useCallback(
        (event: LayoutChangeEvent) => {
            sliderRowHeight.value = event.nativeEvent.layout.height;
        },
        [sliderRowHeight],
    );

    const sliderRowNode = (
        <View
            className={cn("group flex-row items-center pb-1 pt-1", !currentTrack && "opacity-0")}
            onLayout={handleSliderRowLayout}
        >
            <CurrentTime currentLocalTime$={currentLocalTime$} />
            <CustomSlider
                style={{ height: 24, flex: 1 }}
                minimumValue={0}
                $maximumValue={localPlayerState$.duration}
                $value={currentLocalTime$}
                onSlidingStart={handleSlidingStart}
                onSlidingComplete={(value) => {
                    localAudioControls.seek(value);
                }}
                onSlidingEnd={handleSlidingEnd}
                minimumTrackTintColor="#ffffff"
                maximumTrackTintColor="#ffffff40"
                disabled={!currentTrack}
            />
            <CurrentDuration />
        </View>
    );

    // perfLog("PlaybackArea.state", {
    //     track: currentTrack?.title,
    //     isLoading,
    //     isPlaying,
    //     currentTime: currentLocalTime$.peek?.(),
    // });

    return (
        <View className={cn("px-3 pt-3", showBorder && "border-b border-white/10")}>
            <View className="flex-row items-center">
                {/* Album Art */}
                <View className="mr-3">
                    <AlbumArt
                        uri={currentTrack?.thumbnail}
                        reloadKey={currentTrack?.thumbnailVersion}
                        size="large"
                        fallbackIcon="♪"
                    />
                </View>

                {/* Song Info */}
                <View
                    className={cn("flex-1 flex-col overflow-hidden")}
                    style={{ maxWidth: overlayModeEnabled ? OVERLAY_WINDOW_WIDTH_COMPACT - 148 : undefined }}
                >
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                        {currentTrack?.title || " "}
                    </Text>
                    <Text className="text-white/70 text-sm" numberOfLines={1}>
                        {currentTrack?.artist || " "}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    {overlayModeEnabled ? (
                        <Animated.View
                            className={cn(overlayModeEnabled && "absolute top-0 bottom-0")}
                            pointerEvents={overlayControlsVisible ? "auto" : "none"}
                            style={[controlsAnimatedStyle, { right: -64 }]}
                        >
                            {playbackControlsNode}
                        </Animated.View>
                    ) : (
                        playbackControlsNode
                    )}
                </View>
            </View>
            {overlayModeEnabled ? (
                <Animated.View
                    pointerEvents={overlayControlsVisible ? "auto" : "none"}
                    style={[sliderAnimatedStyle, { overflow: "hidden" }]}
                >
                    {sliderRowNode}
                </Animated.View>
            ) : (
                sliderRowNode
            )}
        </View>
    );
}
