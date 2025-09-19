import type { Observable } from "@legendapp/state";
import { Memo, use$ } from "@legendapp/state/react";
import { memo } from "react";
import { Text, View } from "react-native";
import { AlbumArt } from "@/components/AlbumArt";
import { Button } from "@/components/Button";
import { CustomSlider } from "@/components/CustomSlider";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { cn } from "@/utils/cn";
import { perfCount, perfLog } from "@/utils/perfLogger";

// Format time for local playback with caching to reduce computation
const formatTimeCache = new Map<number, string>();

const CurrentTime = memo(function CurrentTime({ currentLocalTime$ }: { currentLocalTime$: Observable<number> }) {
    const time = use$(currentLocalTime$);
    console.log("CurrentTime", time);
    return formatTime(time);
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
            <View className={cn("flex-row items-center pb-2 pt-1", !currentTrack && "opacity-0")}>
                <Text className="text-white/50 text-xs pr-2" style={{ fontVariant: ["tabular-nums"] }}>
                    {duration ? (
                        <>
                            <CurrentTime currentLocalTime$={currentLocalTime$} />
                            {duration ? ` / ${formatTime(duration)}` : " "}
                        </>
                    ) : (
                        " "
                    )}
                </Text>
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
                {/* Playback Controls */}
                <View className="flex-row items-center ml-1 -mr-1">
                    {/* <Button
                            icon="backward.fill"
                            variant="icon-bg"
                            iconSize={14}
                            size="medium"
                            onPress={localAudioControls.playPrevious}
                            className="bg-transparent"
                            // className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/10 rounded-full"
                        /> */}

                    <Button
                        icon={isPlaying ? "pause.fill" : "play.fill"}
                        variant="icon"
                        iconSize={16}
                        size="small"
                        onPress={localAudioControls.togglePlayPause}
                        // className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/15 rounded-full"
                    />

                    <Button
                        icon="forward.end.fill"
                        variant="icon"
                        iconSize={16}
                        size="small"
                        onPress={localAudioControls.playNext}
                        // className="bg-transparent"
                        // className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/10 rounded-full"
                    />
                </View>
            </View>
        </View>
    );
}
