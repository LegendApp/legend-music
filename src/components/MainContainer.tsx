import "@/../global.css";
import { View } from "react-native";

import { PlaylistSelector } from "@/components/PlaylistSelector";
import { PlaybackArea } from "@/components/PlaybackArea";
import { Playlist } from "@/components/Playlist";
import { YouTubeMusicPlayer } from "@/components/YouTubeMusicPlayer";

export function MainContainer() {
    return (
        <View className="flex-1 flex-row items-stretch">
            <View className="flex-1">
                <PlaylistSelector />
                <PlaybackArea />
                <Playlist />
            </View>
            <View className="flex-1">
                <YouTubeMusicPlayer />
            </View>
        </View>
    );
}
