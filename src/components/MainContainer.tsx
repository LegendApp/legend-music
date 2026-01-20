import { useValue } from "@legendapp/state/react";
import { Text, View } from "react-native";
import { initializeAudioPlayer, audioControls } from "@/components/AudioPlayer";
import { PlaybackArea } from "@/components/PlaybackArea";
import { Playlist } from "@/components/Playlist";
import { PlaylistSelector } from "@/components/PlaylistSelector";
import { SkiaSpinner } from "@/components/SkiaSpinner";
import { Unregistered } from "@/components/Unregistered";
import { aiQueueFillState$ } from "@/systems/ai";
import { SUPPORT_ACCOUNTS } from "@/systems/constants";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { state$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";
import { preloadPersistence } from "@/utils/preloadPersistence";

preloadPersistence();
initializeAudioPlayer();

export function MainContainer() {
    perfCount("MainContainer.render");
    // const _playlistNavigation = useValue(playlistNavigationState$);
    const aiQueueFillState = useValue(aiQueueFillState$);
    const showAiQueueSpinner = aiQueueFillState.isGenerating;
    const isStreamingActive = () => {
        const providerId = audioControls.getCurrentState().currentTrack?.provider;
        return Boolean(providerId && providerId !== "local");
    };

    useOnHotkeys({
        PlayPause: () => {
            if (isStreamingActive()) {
                void audioControls.togglePlayPause();
            }
        },
        NextTrack: () => {
            if (isStreamingActive()) {
                audioControls.playNext();
            }
        },
        PreviousTrack: () => {
            if (isStreamingActive()) {
                audioControls.playPrevious();
            }
        },
        ToggleShuffle: audioControls.toggleShuffle,
        ToggleRepeatMode: audioControls.cycleRepeatMode,
        // Only handle space bar globally when no track is selected in the playlist
        PlayPauseSpace: audioControls.togglePlayPause,
        Undo: audioControls.queue.undo,
        Redo: audioControls.queue.redo,
    });

    perfLog("MainContainer.hotkeys", {
        activeTrack: audioControls.getCurrentState().currentTrack?.title,
    });

    return (
        <View
            className="flex-1 flex-row items-stretch relative"
            onMouseEnter={() => state$.isWindowHovered.set(true)}
            onMouseLeave={() => state$.isWindowHovered.set(false)}
        >
            <View className="flex-1">
                <PlaybackArea />
                <Playlist />
                {/* <PlaylistSelector /> */}
                {SUPPORT_ACCOUNTS && <Unregistered />}
            </View>
            {showAiQueueSpinner ? (
                <View pointerEvents="none" className="absolute left-4 right-4 bottom-3">
                    <View className="flex-row items-center gap-2 rounded-md bg-background-tertiary border border-border-primary px-3 py-2">
                        <SkiaSpinner size={18} color="#7dd6ff" trailColor="rgba(255,255,255,0.08)" />
                        <Text className="text-sm text-text-secondary">Generating AI queue...</Text>
                    </View>
                </View>
            ) : null}
        </View>
    );
}
