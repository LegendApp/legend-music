import type { Observable } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import { memo, useEffect } from "react";
import { Text, View } from "react-native";
import { AlbumArt } from "@/components/AlbumArt";
import { Button } from "@/components/Button";
import { CustomSlider } from "@/components/CustomSlider";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { SkiaText } from "@/components/SkiaText";
import { cn } from "@/utils/cn";
import { perfCount } from "@/utils/perfLogger";

type PlaybackAreaProps = {
    showBorder?: boolean;
};

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

export function PlaybackArea({ showBorder = true }: PlaybackAreaProps = {}) {
    perfCount("PlaybackArea.render");
    const currentTrack = use$(localPlayerState$.currentTrack);
    const isPlaying = use$(localPlayerState$.isPlaying);
    const currentLocalTime$ = localPlayerState$.currentTime;

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
                            iconMarginTop={-1}
                            onClick={localAudioControls.togglePlayPause}
                            tooltip={isPlaying ? "Pause" : "Play"}
                            // className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/15 rounded-full"
                        />

                        <Button
                            icon="forward.end.fill"
                            variant="icon"
                            iconSize={16}
                            size="small"
                            iconMarginTop={-1}
                            onClick={localAudioControls.playNext}
                            tooltip="Next"
                            // className="bg-transparent"
                            // className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/10 rounded-full"
                        />
                    </View>
                </View>
            </View>
            <View className={cn("group flex-row items-center pb-1 pt-1", !currentTrack && "opacity-0")}>
                <CurrentTime currentLocalTime$={currentLocalTime$} />
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
                <CurrentDuration />
            </View>
        </View>
    );
}
