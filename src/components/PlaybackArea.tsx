import { useObservable, use$ } from "@legendapp/state/react";
import { View, Text, TouchableOpacity } from "react-native";

export function PlaybackArea() {
    const currentSong$ = useObservable({
        title: "Midnight Dreams",
        artist: "Luna & The Echoes"
    });
    const currentSong = use$(currentSong$);

    return (
        <View className="mx-6 mb-6">
            <View className="flex-row items-center mb-6">
                {/* Album Art */}
                <View className="w-24 h-24 bg-orange-300 rounded-2xl items-center justify-center mr-6">
                    <Text className="text-white text-2xl">♪</Text>
                </View>

                {/* Song Info */}
                <View className="flex-1">
                    <Text className="text-white text-xl font-semibold mb-1">
                        {currentSong.title}
                    </Text>
                    <Text className="text-white/70 text-base">
                        {currentSong.artist}
                    </Text>
                </View>
            </View>

            {/* Playback Controls */}
            <View className="flex-row items-center justify-center space-x-4">
                <TouchableOpacity className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
                    <Text className="text-white text-lg">⏮</Text>
                </TouchableOpacity>

                <TouchableOpacity className="w-16 h-16 bg-white/30 rounded-full items-center justify-center">
                    <Text className="text-white text-xl">▶</Text>
                </TouchableOpacity>

                <TouchableOpacity className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
                    <Text className="text-white text-lg">⏭</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}