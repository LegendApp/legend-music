import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { menuManager } from "@/native-modules/NativeMenuManager";
import { type RepeatMode, settings$ } from "@/systems/Settings";
import { state$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";

let isInitialized = false;

function updateRepeatMenu(mode: RepeatMode) {
    const menuTitle = mode === "all" ? "Repeat All" : mode === "one" ? "Repeat One" : "Repeat Off";
    menuManager.setMenuItemState("playbackToggleRepeat", mode !== "off");
    menuManager.setMenuItemTitle("playbackToggleRepeat", menuTitle);
}

function updateShuffleMenu(isEnabled: boolean) {
    menuManager.setMenuItemState("playbackToggleShuffle", isEnabled);
}

function updatePlayPauseMenu(isPlaying: boolean) {
    menuManager.setMenuItemTitle("playbackPlayPause", isPlaying ? "Pause" : "Play");
}

export function initializeMenuManager() {
    if (isInitialized) {
        return;
    }
    isInitialized = true;

    perfLog("MenuManager.initialize");
    menuManager.addListener("onMenuCommand", (e) => {
        perfCount("MenuManager.onMenuCommand");
        perfLog("MenuManager.onMenuCommand", e);
        switch (e.commandId) {
            case "settings":
                state$.showSettings.set(true);
                break;
            case "jump":
                perfLog("MenuManager.jumpCommand");
                break;
            case "playbackPrevious":
                localAudioControls.playPrevious();
                break;
            case "playbackPlayPause":
                void localAudioControls.togglePlayPause();
                break;
            case "playbackNext":
                localAudioControls.playNext();
                break;
            case "playbackToggleShuffle":
                localAudioControls.toggleShuffle();
                break;
            case "playbackToggleRepeat":
                localAudioControls.cycleRepeatMode();
                break;
            default:
                break;
        }
    });

    updateShuffleMenu(settings$.playback.shuffle.get());
    updateRepeatMenu(settings$.playback.repeatMode.get());
    updatePlayPauseMenu(localPlayerState$.isPlaying.get());

    settings$.playback.shuffle.onChange(({ value }) => {
        updateShuffleMenu(!!value);
    });
    settings$.playback.repeatMode.onChange(({ value }) => {
        updateRepeatMenu(value as RepeatMode);
    });
    localPlayerState$.isPlaying.onChange(({ value }) => {
        updatePlayPauseMenu(!!value);
    });
}
