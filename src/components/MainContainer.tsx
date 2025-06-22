import "@/../global.css";
import { View } from "react-native";

import { PlaybackArea } from "@/components/PlaybackArea";
import { Playlist } from "@/components/Playlist";
import { PlaylistSelector } from "@/components/PlaylistSelector";
import { YouTubeMusicPlayer } from "@/components/YouTubeMusicPlayer";

export function MainContainer() {
    return (
        <View className="flex-1 flex-row items-stretch">
            <View className="flex-1">
                <PlaybackArea />
                <PlaylistSelector />
                <Playlist />
            </View>
            <View className="flex-1">
                <YouTubeMusicPlayer />
            </View>
        </View>
    );
}
