import type { Observable } from "@legendapp/state";
import { use$, useObserveEffect } from "@legendapp/state/react";
import { memo, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import Animated, { useAnimatedProps, useSharedValue } from "react-native-reanimated";
import { AlbumArt } from "@/components/AlbumArt";
import { Button } from "@/components/Button";
import { CustomSlider } from "@/components/CustomSlider";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { cn } from "@/utils/cn";
import { perfCount, perfLog } from "@/utils/perfLogger";

// Format time for local playback with caching to reduce computation
const formatTimeCache = new Map<number, string>();

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const CurrentTime = memo(function CurrentTime({
    currentLocalTime$,
    duration,
}: {
    currentLocalTime$: Observable<number>;
    duration: number | undefined;
}) {
    const text = useSharedValue("asdf");

    useObserveEffect(() => {
        const currentTime = currentLocalTime$.get();
        const formattedDuration = duration ? formatTime(duration) : undefined;
        const display = formattedDuration ? `${formatTime(currentTime)} / ${formattedDuration}` : " ";
        text.set(display);
        console.log("CurrentTime.useObserveEffect", display);
    });

    // Animated prop maps shared value -> native TextInput "text" prop
    const animatedProps = useAnimatedProps(() => {
        console.log("CurrentTime.useAnimatedProps", text.get());
        return {
            defaultValue: text.get(),
            text: text.get(),
        };
    });

    return (
        <AnimatedTextInput
            className="text-white/70 text-xs pr-2 transition-opacity duration-150 w-[88px] absolute"
            numberOfLines={1}
            // ellipsizeMode="clip"
            style={{ fontVariant: ["tabular-nums"] }}
            animatedProps={animatedProps}
            editable={false}
        />
    );
});

function formatTime(seconds: number): string {
    // Round to nearest second for caching efficiency
    const roundedSeconds = Math.floor(seconds);

    if (formatTimeCache.has(roundedSeconds)) {
        return formatTimeCache.get(roundedSeconds)!;
    }

    const mins = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;

    // Cache the result (limit cache size to prevent memory leaks)
    if (formatTimeCache.size > 1000) {
        formatTimeCache.clear();
    }
    formatTimeCache.set(roundedSeconds, formatted);

    return formatted;
}

export function PlaybackArea() {
    perfCount("PlaybackArea.render");
    const currentTrack = use$(localPlayerState$.currentTrack);
    const isLoading = use$(localPlayerState$.isLoading);
    const isPlaying = use$(localPlayerState$.isPlaying);
    const currentLocalTime$ = localPlayerState$.currentTime;
    const duration = use$(localPlayerState$.duration);
    const [isSliderHovered, setIsSliderHovered] = useState(false);

    useEffect(() => {
        if (!currentTrack) {
            setIsSliderHovered(false);
        }
    }, [currentTrack]);

    perfLog("PlaybackArea.state", {
        track: currentTrack?.title,
        isLoading,
        isPlaying,
        currentTime: currentLocalTime$.peek?.(),
        duration,
    });

    return (
        <View className="px-3 pt-3 border-b border-white/10">
            <View className="flex-row items-center">
                {/* Album Art */}
                <View className="mr-3">
                    <AlbumArt uri={currentTrack?.thumbnail} size="large" fallbackIcon="♪" />
                </View>

                {/* Song Info */}
                <View className="flex-1 flex-col">
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                        {currentTrack?.title || " "}
                    </Text>
                    <Text className="text-white/70 text-sm" numberOfLines={1}>
                        {currentTrack?.artist || " "}
                    </Text>
                </View>
            </View>
            <View
                className={cn("group flex-row items-center pb-1 pt-1", !currentTrack && "opacity-0")}
                onMouseLeave={() => setIsSliderHovered(false)}
            >
                <CurrentTime currentLocalTime$={currentLocalTime$} duration={duration} />
                <CustomSlider
                    style={{ height: 24, flex: 1 }}
                    minimumValue={0}
                    $maximumValue={localPlayerState$.duration}
                    $value={currentLocalTime$}
                    onHoverChange={setIsSliderHovered}
                    onSlidingComplete={(value) => {
                        localAudioControls.seek(value);
                    }}
                    minimumTrackTintColor="#ffffff"
                    maximumTrackTintColor="#ffffff40"
                    disabled={!currentTrack}
                />
                {/* Playback Controls */}
                <View className="flex-row items-center ml-1 -mr-1">
                    {/* <Button
                            icon="backward.fill"
                            variant="icon-bg"
                            iconSize={14}
                            size="medium"
                            onClick={localAudioControls.playPrevious}
                            className="bg-transparent"
                            // className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/10 rounded-full"
                        /> */}

                    <Button
                        icon={isPlaying ? "pause.fill" : "play.fill"}
                        variant="icon"
                        iconSize={16}
                        size="small"
                        onClick={localAudioControls.togglePlayPause}
                        tooltip={isPlaying ? "Pause" : "Play"}
                        // className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/15 rounded-full"
                    />

                    <Button
                        icon="forward.end.fill"
                        variant="icon"
                        iconSize={16}
                        size="small"
                        onClick={localAudioControls.playNext}
                        tooltip="Next"
                        // className="bg-transparent"
                        // className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/10 rounded-full"
                    />
                </View>
            </View>
        </View>
    );
}
