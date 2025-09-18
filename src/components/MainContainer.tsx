import "@/../global.css";
import { View } from "react-native";
import { LocalAudioPlayer, localAudioControls } from "@/components/LocalAudioPlayer";
import { PlaybackArea } from "@/components/PlaybackArea";
import { Playlist } from "@/components/Playlist";
import { PlaylistSelector } from "@/components/PlaylistSelector";
import { Unregistered } from "@/components/Unregistered";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { perfCount, perfLog } from "@/utils/perfLogger";

export function MainContainer() {
    perfCount("MainContainer.render");
    useOnHotkeys({
        PlayPause: localAudioControls.togglePlayPause,
        NextTrack: localAudioControls.playNext,
        PreviousTrack: localAudioControls.playPrevious,
    });

    perfLog("MainContainer.hotkeys", {
        activeTrack: localAudioControls.getCurrentState().currentTrack?.title,
    });

    return (
        <View className="flex-1 flex-row items-stretch">
            <View className="flex-1">
                <PlaybackArea />
                <PlaylistSelector />
                <Playlist />
                <Unregistered />
            </View>
            <LocalAudioPlayer />
        </View>
    );
}
