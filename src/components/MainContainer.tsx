import "@/../global.css";
import { View } from "react-native";
import { LocalAudioPlayer } from "@/components/LocalAudioPlayer";
import { MediaLibrary } from "@/components/MediaLibrary";
import { PlaybackArea } from "@/components/PlaybackArea";
import { Playlist } from "@/components/Playlist";
import { PlaylistSelector } from "@/components/PlaylistSelector";
import { Unregistered } from "@/components/Unregistered";

export function MainContainer() {
    return (
        <View className="flex-1 flex-row items-stretch">
            <View className="flex-1">
                <PlaybackArea />
                <PlaylistSelector />
                <Playlist />
                <MediaLibrary />
                <Unregistered />
            </View>
            <LocalAudioPlayer />
        </View>
    );
}
