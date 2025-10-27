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
    // const _playlistNavigation = use$(playlistNavigationState$);

    useOnHotkeys(
        {
            // PlayPause: localAudioControls.togglePlayPause,
            // NextTrack: localAudioControls.playNext,
            // PreviousTrack: localAudioControls.playPrevious,
            // Only handle space bar globally when no track is selected in the playlist
            PlayPauseSpace: localAudioControls.togglePlayPause,
        },
        { global: true },
    );

    perfLog("MainContainer.hotkeys", {
        activeTrack: localAudioControls.getCurrentState().currentTrack?.title,
    });

    return (
        <View className="flex-1 flex-row items-stretch">
            <View className="flex-1">
                <PlaybackArea />
                <Playlist />
                <PlaylistSelector />
                <Unregistered />
            </View>
            <LocalAudioPlayer />
        </View>
    );
}
