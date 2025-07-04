import { use$ } from "@legendapp/state/react";
import { Image, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { CustomSlider } from "@/components/CustomSlider";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { controls, playbackState$ } from "@/components/YouTubeMusicPlayer";
import { localMusicState$ } from "@/systems/LocalMusicState";

export function PlaybackArea() {
    const playbackState = use$(playbackState$);
    const localMusicState = use$(localMusicState$);
    const localPlayerState = use$(localPlayerState$);

    // Determine if we're using local files or YouTube Music
    const isLocalFilesSelected = localMusicState.isLocalFilesSelected;

    // Format time for local playback
    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    // Parse time string like "0:25 / 1:23" to get seconds from first time
    function parseCurrentTimeSeconds(timeString: string | number): number {
        if (typeof timeString === "number") {
            return timeString;
        }

        // Split by " / " and take the first part
        const firstTime = timeString.split(" / ")[0];

        // Parse "0:25" format
        const [minutes, seconds] = firstTime.split(":").map(Number);
        return minutes * 60 + seconds;
    }

    // Use appropriate state based on current selection
    const currentTrack = isLocalFilesSelected ? localPlayerState.currentTrack : playbackState.currentTrack;
    const isLoading = isLocalFilesSelected ? localPlayerState.isLoading : playbackState.isLoading;
    const isPlaying = isLocalFilesSelected ? localPlayerState.isPlaying : playbackState.isPlaying;
    const currentTime = isLocalFilesSelected ? formatTime(localPlayerState.currentTime) : playbackState.currentTime;
    const currentTimeSeconds = isLocalFilesSelected
        ? localPlayerState.currentTime
        : parseCurrentTimeSeconds(playbackState.currentTime);
    const duration = isLocalFilesSelected ? localPlayerState.duration : 0;

    return (
        <View className="mx-3 mt-3">
            <View className="flex-row items-center">
                {/* Album Art */}
                <View className="size-12 items-center justify-center mr-4">
                    {currentTrack?.thumbnail ? (
                        <Image
                            source={{ uri: currentTrack.thumbnail }}
                            className="w-full h-full rounded-lg"
                            resizeMode="cover"
                        />
                    ) : (
                        <Text className="text-white text-lg">♪</Text>
                    )}
                </View>

                {/* Song Info */}
                <View className="flex-1 flex-col">
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                        {currentTrack?.title || (isLoading ? "Loading..." : "No track")}
                    </Text>
                    <Text className="text-white/70 text-sm" numberOfLines={1}>
                        {currentTrack?.artist || ""}
                    </Text>
                    {currentTrack && (
                        <Text className="text-white/50 text-xs" style={{ fontVariant: ["tabular-nums"] }}>
                            {currentTime}
                        </Text>
                    )}
                </View>

                {/* Playback Controls */}
                <View className="flex-row items-center gap-x-2 ml-4">
                    <Button
                        icon="backward.fill"
                        variant="icon-bg"
                        size="medium"
                        onPress={isLocalFilesSelected ? localAudioControls.playPrevious : controls.previous}
                        disabled={isLoading}
                        className="w-10 h-10 bg-white/15 hover:bg-white/25 active:bg-white/35 rounded-xl border border-white/10"
                    />

                    <Button
                        icon={isLoading ? "ellipsis" : isPlaying ? "pause.fill" : "play.fill"}
                        variant="icon-bg"
                        size="large"
                        onPress={isLocalFilesSelected ? localAudioControls.togglePlayPause : controls.playPause}
                        disabled={isLoading}
                        className="w-12 h-12 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-xl border border-white/15 shadow-lg"
                    />

                    <Button
                        icon="forward.fill"
                        variant="icon-bg"
                        size="medium"
                        onPress={isLocalFilesSelected ? localAudioControls.playNext : controls.next}
                        disabled={isLoading}
                        className="w-10 h-10 bg-white/15 hover:bg-white/25 active:bg-white/35 rounded-xl border border-white/10"
                    />
                </View>
            </View>

            <View className="pb-1">
                <CustomSlider
                    style={{ height: 32 }}
                    minimumValue={0}
                    maximumValue={duration || 100}
                    value={currentTimeSeconds}
                    onSlidingComplete={(value) => {
                        if (isLocalFilesSelected) {
                            localAudioControls.seek(value);
                        }
                    }}
                    minimumTrackTintColor="#ffffff"
                    maximumTrackTintColor="#ffffff40"
                    disabled={!currentTrack}
                />
            </View>
        </View>
    );
}
