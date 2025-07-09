import "@/../global.css";
import { useSelector } from "@legendapp/state/react";
import { View } from "react-native";
import { LocalAudioPlayer } from "@/components/LocalAudioPlayer";
import { PlaybackArea } from "@/components/PlaybackArea";
import { Playlist } from "@/components/Playlist";
import { PlaylistSelector } from "@/components/PlaylistSelector";
import { Unregistered } from "@/components/Unregistered";
import { YouTubeMusicPlayer } from "@/components/YouTubeMusicPlayer";
import { settings$ } from "@/systems/Settings";
import { stateSaved$ } from "@/systems/State";

export function MainContainer() {
    const showYtm = useSelector(stateSaved$.showYtm);
    const enabledYtm = useSelector(settings$.youtubeMusic.enabled);

    return (
        <View className="flex-1 flex-row items-stretch">
            <View className="flex-1">
                <PlaybackArea />
                <PlaylistSelector />
                <Playlist />
                <Unregistered />
            </View>
            {enabledYtm && (
                <View className={showYtm ? "flex-1" : "absolute -z-10 inset-0 hidden"}>
                    <YouTubeMusicPlayer />
                </View>
            )}
            <LocalAudioPlayer />
        </View>
    );
}
