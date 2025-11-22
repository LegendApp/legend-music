import { localAudioControls, localPlayerState$ } from "@/components/LocalAudioPlayer";
import { menuManager, type MenuShortcut } from "@/native-modules/NativeMenuManager";
import { type RepeatMode, settings$ } from "@/systems/Settings";
import { state$ } from "@/systems/State";
import { hotkeys$ } from "@/systems/hotkeys";
import type { KeyboardEventCodeHotkey } from "@/systems/keyboard/Keyboard";
import { KeyCodes, KeyText } from "@/systems/keyboard/KeyboardManager";
import { perfCount, perfLog } from "@/utils/perfLogger";

let isInitialized = false;

const MENU_MODIFIERS = [
    KeyCodes.MODIFIER_COMMAND,
    KeyCodes.MODIFIER_SHIFT,
    KeyCodes.MODIFIER_OPTION,
    KeyCodes.MODIFIER_CONTROL,
    KeyCodes.MODIFIER_CAPS_LOCK,
    KeyCodes.MODIFIER_FUNCTION,
] as const;
const MENU_MODIFIER_SET = new Set<number>(MENU_MODIFIERS);

const FUNCTION_KEY_EQUIVALENTS: Record<number, number> = {
    [KeyCodes.KEY_UP]: 0xf700,
    [KeyCodes.KEY_DOWN]: 0xf701,
    [KeyCodes.KEY_LEFT]: 0xf702,
    [KeyCodes.KEY_RIGHT]: 0xf703,
};

const TEXT_TO_KEYCODE = Object.entries(KeyText).reduce<Record<string, number>>((acc, [key, text]) => {
    acc[text] = Number(key);
    return acc;
}, {});

function parseSegmentToKeyCode(segment: string | number): number | null {
    const textSegment = `${segment}`;
    if (textSegment.length === 0) {
        return null;
    }
    if (TEXT_TO_KEYCODE[textSegment] !== undefined) {
        return TEXT_TO_KEYCODE[textSegment];
    }

    const numeric = Number(textSegment);
    if (!Number.isNaN(numeric)) {
        return numeric;
    }

    return null;
}

function keyCodeToMenuKeyEquivalent(keyCode: number): string | null {
    if (FUNCTION_KEY_EQUIVALENTS[keyCode] !== undefined) {
        return String.fromCharCode(FUNCTION_KEY_EQUIVALENTS[keyCode]);
    }

    switch (keyCode) {
        case KeyCodes.KEY_RETURN:
            return "\r";
        case KeyCodes.KEY_TAB:
            return "\t";
        case KeyCodes.KEY_SPACE:
            return " ";
        case KeyCodes.KEY_ESCAPE:
            return "\u001b";
        case KeyCodes.KEY_DELETE:
        case KeyCodes.KEY_BACKSPACE:
            return "\u0008";
        case KeyCodes.KEY_FORWARD_DELETE:
            return String.fromCharCode(0x007f);
        default: {
            const text = KeyText[keyCode];
            if (text && text.length === 1) {
                return text.toLowerCase();
            }
            return null;
        }
    }
}

function hotkeyToMenuShortcut(hotkey?: KeyboardEventCodeHotkey): MenuShortcut | null {
    if (hotkey === undefined || hotkey === null) {
        return null;
    }

    const segments = typeof hotkey === "number" ? [hotkey] : `${hotkey}`.split("+");
    let modifiers = 0;
    let keyCode: number | null = null;

    for (const segment of segments) {
        const parsed = parseSegmentToKeyCode(segment);
        if (parsed === null) {
            continue;
        }

        if (MENU_MODIFIER_SET.has(parsed)) {
            modifiers |= parsed;
            continue;
        }

        if (keyCode === null) {
            keyCode = parsed;
        }
    }

    if (keyCode === null) {
        return null;
    }

    const keyEquivalent = keyCodeToMenuKeyEquivalent(keyCode);
    if (!keyEquivalent) {
        return null;
    }

    return { key: keyEquivalent, modifiers };
}

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

function updatePlaybackMenuShortcuts() {
    const hotkeys = hotkeys$.get();

    const playPauseShortcut =
        hotkeyToMenuShortcut(hotkeys.PlayPause) ?? hotkeyToMenuShortcut(hotkeys.PlayPauseSpace);

    menuManager.setMenuItemShortcut("playbackPrevious", hotkeyToMenuShortcut(hotkeys.PreviousTrack));
    menuManager.setMenuItemShortcut("playbackPlayPause", playPauseShortcut);
    menuManager.setMenuItemShortcut("playbackNext", hotkeyToMenuShortcut(hotkeys.NextTrack));
    menuManager.setMenuItemShortcut("playbackToggleShuffle", hotkeyToMenuShortcut(hotkeys.ToggleShuffle));
    menuManager.setMenuItemShortcut("playbackToggleRepeat", hotkeyToMenuShortcut(hotkeys.ToggleRepeatMode));
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
    updatePlaybackMenuShortcuts();

    settings$.playback.shuffle.onChange(({ value }) => {
        updateShuffleMenu(!!value);
    });
    settings$.playback.repeatMode.onChange(({ value }) => {
        updateRepeatMenu(value as RepeatMode);
    });
    localPlayerState$.isPlaying.onChange(({ value }) => {
        updatePlayPauseMenu(!!value);
    });
    hotkeys$.onChange(() => {
        updatePlaybackMenuShortcuts();
    });
}
