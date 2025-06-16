import { use$ } from "@legendapp/state/react";
import { View, Text, TouchableOpacity, Image } from "react-native";

import { playerState$, controls } from "@/components/YouTubeMusicPlayer";

export function PlaybackArea() {
    const playerState = use$(playerState$);

    const currentTrack = playerState.currentTrack;
    const isLoading = playerState.isLoading;
    const isPlaying = playerState.isPlaying;

    return (
        <View className="mx-6 mb-6">
            <View className="flex-row items-center mb-6">
                {/* Album Art */}
                <View className="w-24 h-24 bg-orange-300 rounded-2xl items-center justify-center mr-6">
                    {currentTrack?.thumbnail ? (
                        <Image 
                            source={{ uri: currentTrack.thumbnail }} 
                            className="w-full h-full rounded-2xl"
                            resizeMode="cover"
                        />
                    ) : (
                        <Text className="text-white text-2xl">♪</Text>
                    )}
                </View>

                {/* Song Info */}
                <View className="flex-1">
                    <Text className="text-white text-xl font-semibold mb-1">
                        {currentTrack?.title || (isLoading ? "Loading..." : "No track")}
                    </Text>
                    <Text className="text-white/70 text-base">
                        {currentTrack?.artist || ""}
                    </Text>
                    {currentTrack && (
                        <Text className="text-white/50 text-sm mt-1">
                            {playerState.currentTime} / {currentTrack.duration}
                        </Text>
                    )}
                </View>
            </View>

            {/* Playback Controls */}
            <View className="flex-row items-center justify-center space-x-4">
                <TouchableOpacity 
                    className="w-12 h-12 bg-white/20 rounded-full items-center justify-center"
                    onPress={controls.previous}
                    disabled={isLoading}
                >
                    <Text className="text-white text-lg">⏮</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    className="w-16 h-16 bg-white/30 rounded-full items-center justify-center"
                    onPress={controls.playPause}
                    disabled={isLoading}
                >
                    <Text className="text-white text-xl">
                        {isLoading ? "..." : (isPlaying ? "⏸" : "▶")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    className="w-12 h-12 bg-white/20 rounded-full items-center justify-center"
                    onPress={controls.next}
                    disabled={isLoading}
                >
                    <Text className="text-white text-lg">⏭</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}