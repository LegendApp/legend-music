import { View } from "react-native";
import { initializeLocalAudioPlayer, localAudioControls } from "@/components/LocalAudioPlayer";
import { PlaybackArea } from "@/components/PlaybackArea";
import { Playlist } from "@/components/Playlist";
import { Unregistered } from "@/components/Unregistered";
import { SUPPORT_ACCOUNTS } from "@/systems/constants";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { state$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";
import { preloadPersistence } from "@/utils/preloadPersistence";

preloadPersistence();
initializeLocalAudioPlayer();

export function MainContainer() {
    perfCount("MainContainer.render");
    // const _playlistNavigation = useValue(playlistNavigationState$);

    useOnHotkeys({
        // These are handled by native media keys, don't need to handle them here
        // PlayPause: localAudioControls.togglePlayPause,
        // NextTrack: localAudioControls.playNext,
        // PreviousTrack: localAudioControls.playPrevious,
        ToggleShuffle: localAudioControls.toggleShuffle,
        ToggleRepeatMode: localAudioControls.cycleRepeatMode,
        // Only handle space bar globally when no track is selected in the playlist
        PlayPauseSpace: localAudioControls.togglePlayPause,
    });

    perfLog("MainContainer.hotkeys", {
        activeTrack: localAudioControls.getCurrentState().currentTrack?.title,
    });

    return (
        <View
            className="flex-1 flex-row items-stretch"
            onMouseEnter={() => state$.isWindowHovered.set(true)}
            onMouseLeave={() => state$.isWindowHovered.set(false)}
        >
            <View className="flex-1">
                <PlaybackArea />
                <Playlist />
                {SUPPORT_ACCOUNTS && <Unregistered />}
            </View>
        </View>
    );
}
