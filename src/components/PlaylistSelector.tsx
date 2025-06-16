import { useObservable, use$ } from "@legendapp/state/react";
import { View, Text, TouchableOpacity } from "react-native";

export function PlaylistSelector() {
    const selectedPlaylist$ = useObservable("My Favorites");
    const selectedPlaylist = use$(selectedPlaylist$);

    return (
        <View className="mx-6 mt-6 mb-4">
            <TouchableOpacity className="bg-white/20 rounded-2xl px-6 py-4 flex-row items-center justify-between">
                <Text className="text-white text-lg font-medium">
                    {selectedPlaylist}
                </Text>
                <Text className="text-white/70 text-lg">⌄</Text>
            </TouchableOpacity>
        </View>
    );
}