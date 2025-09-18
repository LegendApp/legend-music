import { Memo, use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { AlbumArt } from "@/components/AlbumArt";
import { Button } from "@/components/Button";
import { CustomSlider } from "@/components/CustomSlider";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { perfCount, perfLog } from "@/utils/perfLogger";

// Format time for local playback with caching to reduce computation
const formatTimeCache = new Map<number, string>();

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
    const duration$ = localPlayerState$.duration;

    perfLog("PlaybackArea.state", {
        track: currentTrack?.title,
        isLoading,
        isPlaying,
        currentTime: currentLocalTime$.peek?.() ?? currentLocalTime$.get?.(),
        duration: duration$.peek?.() ?? duration$.get?.(),
    });

    return (
        <View className="mx-3 mt-3">
            <View className="flex-row items-center">
                {/* Album Art */}
                <View className="mr-4">
                    <AlbumArt uri={currentTrack?.thumbnail} size="large" fallbackIcon="♪" />
                </View>

                {/* Song Info */}
                <View className="flex-1 flex-col">
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                        {currentTrack?.title || (isLoading ? "Loading..." : " ")}
                    </Text>
                    <Text className="text-white/70 text-sm" numberOfLines={1}>
                        {currentTrack?.artist || " "}
                    </Text>
                    <Text className="text-white/50 text-xs" style={{ fontVariant: ["tabular-nums"] }}>
                        <Memo>{() => `${formatTime(currentLocalTime$.get())} / ${formatTime(duration$.get())}`}</Memo>
                    </Text>
                </View>

                {/* Playback Controls */}
                <View className="flex-row items-center gap-x-2 ml-4">
                    <Button
                        icon="backward.fill"
                        variant="icon-bg"
                        iconSize={16}
                        size="medium"
                        onPress={localAudioControls.playPrevious}
                        disabled={isLoading}
                        className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/10 rounded-full"
                    />

                    <Button
                        icon={isLoading ? "ellipsis" : isPlaying ? "pause.fill" : "play.fill"}
                        variant="icon-bg"
                        iconSize={18}
                        size="medium"
                        onPress={localAudioControls.togglePlayPause}
                        disabled={isLoading}
                        className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/15 rounded-full"
                    />

                    <Button
                        icon="forward.fill"
                        variant="icon-bg"
                        iconSize={16}
                        size="medium"
                        onPress={localAudioControls.playNext}
                        disabled={isLoading}
                        className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/10 rounded-full"
                    />
                </View>
            </View>

            <View className="pb-1">
                <CustomSlider
                    style={{ height: 32 }}
                    minimumValue={0}
                    $maximumValue={duration$}
                    $value={currentLocalTime$}
                    onSlidingComplete={(value) => {
                        localAudioControls.seek(value);
                    }}
                    minimumTrackTintColor="#ffffff"
                    maximumTrackTintColor="#ffffff40"
                    disabled={!currentTrack}
                />
            </View>
        </View>
    );
}
