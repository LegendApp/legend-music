import { useObservable, use$ } from "@legendapp/state/react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";

interface Song {
    id: number;
    title: string;
    artist: string;
    duration: string;
    isPlaying?: boolean;
}

export function Playlist() {
    const songs$ = useObservable<Song[]>([
        { id: 1, title: "Midnight Dreams", artist: "Luna & The Moon Ranger", duration: "3:47", isPlaying: true },
        { id: 2, title: "Neon Lights", artist: "Electric Sunset", duration: "4:12" },
        { id: 3, title: "Ocean Waves", artist: "Coastal Drive", duration: "5:23" },
        { id: 4, title: "City Rain", artist: "Urban Melody", duration: "3:56" },
        { id: 5, title: "Golden Hour", artist: "Sunset Boulevard", duration: "4:44" },
        { id: 6, title: "Starlight Serenade", artist: "Night Sky Or Other Thing", duration: "6:18" },
        { id: 7, title: "Digital Horizon", artist: "Cyber Dreams", duration: "4:33" },
        { id: 8, title: "Autumn Leaves", artist: "Seasonal Sounds", duration: "3:21" },
    ]);

    const songs = use$(songs$);

    return (
        <View className="flex-1">
            <ScrollView showsVerticalScrollIndicator={false}>
                {songs.map((song, index) => (
                    <TouchableOpacity
                        key={song.id}
                        className={`flex-row items-center px-6 py-4 ${
                            song.isPlaying ? 'bg-white/10' : ''
                        }`}
                    >
                        <Text className="text-white/60 text-base w-8">
                            {index + 1}
                        </Text>

                        <View className="flex-1 ml-4">
                            <Text className="text-white text-base font-medium mb-1">
                                {song.title} • {song.artist}
                            </Text>
                        </View>

                        <Text className="text-white/60 text-base">
                            {song.duration}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}