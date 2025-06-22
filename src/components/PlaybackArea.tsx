import { use$ } from "@legendapp/state/react";
import { Image, Text, TouchableOpacity, View } from "react-native";

import { controls, playerState$ } from "@/components/YouTubeMusicPlayer";

export function PlaybackArea() {
    const playerState = use$(playerState$);

    const currentTrack = playerState.currentTrack;
    const isLoading = playerState.isLoading;
    const isPlaying = playerState.isPlaying;

    return (
        <View className="mx-6 mt-8">
            <View className="flex-row items-center">
                {/* Album Art */}
                <View className="size-16 bg-orange-300 rounded-xl items-center justify-center mr-4">
                    {currentTrack?.thumbnail ? (
                        <Image
                            source={{ uri: currentTrack.thumbnail }}
                            className="w-full h-full rounded-xl"
                            resizeMode="cover"
                        />
                    ) : (
                        <Text className="text-white text-lg">♪</Text>
                    )}
                </View>

                {/* Song Info */}
                <View className="flex-1 flex-col">
                    <Text className="text-white text-lg font-semibold">
                        {currentTrack?.title || (isLoading ? "Loading..." : "No track")}
                    </Text>
                    <Text className="text-white/70 text-base">{currentTrack?.artist || ""}</Text>
                    {currentTrack && <Text className="text-white/50 text-sm mt-1">{playerState.currentTime}</Text>}
                </View>

                {/* Playback Controls */}
                <View className="flex-row items-center gap-x-1 ml-4">
                    <TouchableOpacity
                        className="w-8 h-8 bg-white/20 rounded-full items-center justify-center"
                        onPress={controls.previous}
                        disabled={isLoading}
                    >
                        <Text className="text-white text-sm">⏮</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="w-8 h-8 bg-white/30 rounded-full items-center justify-center"
                        onPress={controls.playPause}
                        disabled={isLoading}
                    >
                        <Text className="text-white text-base">{isLoading ? "..." : isPlaying ? "⏸" : "▶"}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="w-8 h-8 bg-white/20 rounded-full items-center justify-center"
                        onPress={controls.next}
                        disabled={isLoading}
                    >
                        <Text className="text-white text-sm">⏭</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
