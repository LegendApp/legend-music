import "@/../global.css";
import { View } from "react-native";

import { LocalAudioPlayer } from "@/components/LocalAudioPlayer";
import { PlaybackArea } from "@/components/PlaybackArea";
import { PlaylistSelector } from "@/components/PlaylistSelector";
import { YouTubeMusicPlayer } from "@/components/YouTubeMusicPlayer";

const ShowYTM = true;

export function MainContainer() {
    return (
        <View className="flex-1 flex-row items-stretch">
            <View className="flex-1">
                <PlaybackArea />
                <PlaylistSelector />
            </View>
            <View className={ShowYTM ? "flex-1" : "absolute -z-10 inset-0 hidden"}>
                <YouTubeMusicPlayer />
            </View>
            <LocalAudioPlayer />
        </View>
    );
}
