import "@/../global.css";
import { View } from "react-native";
import { LocalAudioPlayer, localAudioControls } from "@/components/LocalAudioPlayer";
import { MediaLibrary } from "@/components/MediaLibrary";
import { PlaybackArea } from "@/components/PlaybackArea";
import { Playlist } from "@/components/Playlist";
import { PlaylistSelector } from "@/components/PlaylistSelector";
import { Unregistered } from "@/components/Unregistered";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";

export function MainContainer() {
    useOnHotkeys({
        PlayPause: localAudioControls.togglePlayPause,
        NextTrack: localAudioControls.playNext,
        PreviousTrack: localAudioControls.playPrevious,
    });

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
