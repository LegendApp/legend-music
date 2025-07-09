import { Memo, use$, useObservable } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { AlbumArt } from "@/components/AlbumArt";
import { Button } from "@/components/Button";
import { CustomSlider } from "@/components/CustomSlider";
import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { controls, playbackState$ } from "@/components/YouTubeMusicPlayer";
import { localMusicState$ } from "@/systems/LocalMusicState";

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

function parseDurationSeconds(timeString: string | number): number {
    if (typeof timeString === "number") {
        return timeString;
    }

    // Split by " / " and take the second part
    const secondTime = timeString.split(" / ")[1];

    if (secondTime) {
        // Parse "0:25" format
        const [minutes, seconds] = secondTime.split(":").map(Number);
        return minutes * 60 + seconds;
    }

    return 0;
}

export function PlaybackArea() {
    const playbackState = use$(playbackState$);
    const localMusicState = use$(localMusicState$);
    const isLocalPlaying = use$(localPlayerState$.isPlaying);
    const currentLocalTrack = use$(localPlayerState$.currentTrack);
    const currentLocalIsLoading = use$(localPlayerState$.isLoading);
    const currentLocalTime$ = localPlayerState$.currentTime;
    // TODO
    const currentYtmTime$ = useObservable(0);
    const currentYtmDuration$ = useObservable(0);

    // Determine if we're using local files or YouTube Music
    const isLocalFilesSelected = localMusicState.isLocalFilesSelected;

    // Use appropriate state based on current selection
    const currentTrack = isLocalFilesSelected ? currentLocalTrack : playbackState.currentTrack;
    const isLoading = isLocalFilesSelected ? currentLocalIsLoading : playbackState.isLoading;
    const isPlaying = isLocalFilesSelected ? isLocalPlaying : playbackState.isPlaying;
    const currentTime = isLocalFilesSelected ? undefined : playbackState.currentTime;
    // const currentTimeSeconds = isLocalFilesSelected
    //     ? undefined
    //     : parseCurrentTimeSeconds(playbackState.currentTime);
    // const duration = isLocalFilesSelected ? currentLocalDuration : parseDurationSeconds(playbackState.currentTime || 0);
    const duration$ = isLocalFilesSelected ? localPlayerState$.duration : currentYtmDuration$;

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
                        {isLocalFilesSelected ? (
                            <Memo>
                                {() => `${formatTime(currentLocalTime$.get())} / ${formatTime(duration$.get())}`}
                            </Memo>
                        ) : (
                            <Memo>{currentTrack ? currentTime : " "}</Memo>
                        )}
                    </Text>
                </View>

                {/* Playback Controls */}
                <View className="flex-row items-center gap-x-2 ml-4">
                    <Button
                        icon="backward.fill"
                        variant="icon-bg"
                        iconSize={16}
                        size="medium"
                        onPress={isLocalFilesSelected ? localAudioControls.playPrevious : controls.previous}
                        disabled={isLoading}
                        className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/10 rounded-full"
                    />

                    <Button
                        icon={isLoading ? "ellipsis" : isPlaying ? "pause.fill" : "play.fill"}
                        variant="icon-bg"
                        iconSize={18}
                        size="medium"
                        onPress={isLocalFilesSelected ? localAudioControls.togglePlayPause : controls.playPause}
                        disabled={isLoading}
                        className="bg-white/15 hover:bg-white/25 active:bg-white/35 border-white/15 rounded-full"
                    />

                    <Button
                        icon="forward.fill"
                        variant="icon-bg"
                        iconSize={16}
                        size="medium"
                        onPress={isLocalFilesSelected ? localAudioControls.playNext : controls.next}
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
                    $value={isLocalFilesSelected ? currentLocalTime$ : currentYtmTime$}
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
