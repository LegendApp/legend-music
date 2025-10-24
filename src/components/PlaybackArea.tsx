import type { Observable } from "@legendapp/state";
import { use$, useObservable, useObserveEffect } from "@legendapp/state/react";
import { memo, useEffect, useRef } from "react";
import { Text, TextInput, View } from "react-native";
import { AlbumArt } from "@/components/AlbumArt";
import { Button } from "@/components/Button";
import { CustomSlider } from "@/components/CustomSlider";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { cn } from "@/utils/cn";
import { perfCount } from "@/utils/perfLogger";

// Format time for local playback with caching to reduce computation
const formatTimeCache = new Map<number, string>();

const CurrentTime = memo(function CurrentTime({
    currentLocalTime$,
    isSliderHovered$,
}: {
    currentLocalTime$: Observable<number>;
    isSliderHovered$: Observable<boolean>;
}) {
    // const text = useSharedValue("asdf");
    const ref = useRef<TextInput>(null);
    const isVisible$ = useObservable(true);

    useObserveEffect(() => {
        const currentTime = currentLocalTime$.get();
        const isSliderHovered = isSliderHovered$.get();
        const display = formatTime(currentTime, false) + " ";
        if (isSliderHovered) {
            ref.current?.setNativeProps({ text: display, style: { opacity: 1 } });
            isVisible$.set(true);
        } else {
            if (isVisible$.get()) {
                ref.current?.setNativeProps({ style: { opacity: 0 } });
            }
            isVisible$.set(false);
        }
    });

    // Animated prop maps shared value -> native TextInput "text" prop
    // const animatedProps = useAnimatedProps(() => {
    //     console.log("CurrentTime.useAnimatedProps", text.get());
    //     return {
    //         defaultValue: text.get(),
    //         text: text.get(),
    //     };
    // });

    // const animatedProps = useAnimatedProps(() => {
    //     text.get();
    //     console.log("CurrentTime.useAnimatedProps", text.get());
    //     return {
    //         value: Math.random() + "",
    //         text: Math.random() + "",
    //         defaultValue: Math.random() + "",
    //     };
    // });

    return (
        <TextInput
            className="text-white/70 text-xs pr-2"
            numberOfLines={1}
            // ellipsizeMode="clip"
            style={{ fontVariant: ["tabular-nums"] }}
            // animatedProps={animatedProps}
            editable={false}
            ref={ref}
        />
    );
});

function CurrentDuration({ isSliderHovered$ }: { isSliderHovered$: Observable<boolean> }) {
    const duration = use$(localPlayerState$.duration);
    const isSliderHovered = use$(isSliderHovered$);

    return (
        <Text className={cn("text-white/70 text-xs pl-2", !isSliderHovered && "opacity-0")}>
            {formatTime(duration, true)}
        </Text>
    );
}

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

export function PlaybackArea() {
    perfCount("PlaybackArea.render");
    const currentTrack = use$(localPlayerState$.currentTrack);
    const isPlaying = use$(localPlayerState$.isPlaying);
    const currentLocalTime$ = localPlayerState$.currentTime;
    const isSliderHovered$ = useObservable(false);

    useEffect(() => {
        if (!currentTrack) {
            isSliderHovered$.set(false);
        }
    }, [currentTrack]);

    // perfLog("PlaybackArea.state", {
    //     track: currentTrack?.title,
    //     isLoading,
    //     isPlaying,
    //     currentTime: currentLocalTime$.peek?.(),
    // });

    return (
        <View
            className="px-3 pt-3 border-b border-white/10"
            onMouseEnter={() => isSliderHovered$.set(true)}
            onMouseLeave={() => isSliderHovered$.set(false)}
        >
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
                <View className="flex-row items-center">
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
            <View className={cn("group flex-row items-center pb-1 pt-1", !currentTrack && "opacity-0")}>
                <CurrentTime currentLocalTime$={currentLocalTime$} isSliderHovered$={isSliderHovered$} />
                <CustomSlider
                    style={{ height: 24, flex: 1 }}
                    minimumValue={0}
                    $maximumValue={localPlayerState$.duration}
                    $value={currentLocalTime$}
                    onSlidingComplete={(value) => {
                        localAudioControls.seek(value);
                    }}
                    minimumTrackTintColor="#ffffff"
                    maximumTrackTintColor="#ffffff40"
                    disabled={!currentTrack}
                />
                <CurrentDuration isSliderHovered$={isSliderHovered$} />
            </View>
        </View>
    );
}
