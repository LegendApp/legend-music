import { observable, syncState } from "@legendapp/state";
import type { KeyboardEventCodeHotkey } from "@/systems/keyboard/Keyboard";
import { KeyCodes, KeyText } from "@/systems/keyboard/KeyboardManager";
import { createJSONManager } from "@/utils/JSONManager";

// Default hotkey settings
const DEFAULT_HOTKEYS = {
    Search: KeyCodes.KEY_J,
    ToggleLibrary: KeyCodes.KEY_L,
    ToggleVisualizer: KeyCodes.KEY_V,
    ToggleVisualizerZ: KeyCodes.KEY_Z,
    ToggleVisualizerI: KeyCodes.KEY_I,
    PlayPause: KeyCodes.KEY_MEDIA_PLAY_PAUSE,
    PlayPauseSpace: KeyCodes.KEY_SPACE,
    NextTrack: KeyCodes.KEY_MEDIA_NEXT,
    PreviousTrack: KeyCodes.KEY_MEDIA_PREVIOUS,
    Up: KeyCodes.KEY_UP,
    Down: KeyCodes.KEY_DOWN,
    Enter: KeyCodes.KEY_RETURN,
    Space: KeyCodes.KEY_SPACE,
    Delete: KeyCodes.KEY_DELETE,
} as const;

export type HotkeyName = keyof typeof DEFAULT_HOTKEYS;

export const HotkeyMetadata: Record<HotkeyName, { description: string; repeat?: boolean }> = {
    Search: {
        description: "Search files",
    },
    ToggleLibrary: {
        description: "Toggle media library",
    },
    ToggleVisualizer: {
        description: "Toggle visualizer window",
    },
    ToggleVisualizerZ: {
        description: "Toggle visualizer window (debug: Z key)",
    },
    ToggleVisualizerI: {
        description: "Toggle visualizer window (debug: I key)",
    },
    PlayPause: {
        description: "Toggle playback",
    },
    PlayPauseSpace: {
        description: "Toggle playback (space bar)",
    },
    NextTrack: {
        description: "Play next track",
    },
    PreviousTrack: {
        description: "Play previous track",
    },
    Up: {
        description: "Move selection up",
    },
    Down: {
        description: "Move selection down",
    },
    Enter: {
        description: "Activate selection",
    },
    Space: {
        description: "Activate selection",
    },
    Delete: {
        description: "Delete selected items",
    },
};

// Create the hotkeys manager
export const hotkeys$ = createJSONManager<Record<HotkeyName, KeyboardEventCodeHotkey>>({
    basePath: "Cache",
    filename: "hotkeys.json",
    initialValue: DEFAULT_HOTKEYS,
    saveDefaultToFile: true,
    transform: {
        load: (value: Record<string, string>) => {
            return Object.fromEntries(
                Object.entries(value).map(([key, val]) => {
                    const vals = `${val}`.split("+");
                    const parts = vals.map((v) => {
                        const keyCode = Object.entries(KeyText).find(([, text]) => text === v)?.[0];
                        return keyCode || v;
                    });
                    // Convert the KeyText to corresponding key code
                    return [key, parts.join("+")];
                }),
            );
        },
        save: (value: Record<string, string>) => {
            return Object.fromEntries(
                Object.entries(value).map(([key, val]) => {
                    const vals = `${val}`.split("+");
                    // Add the main key text
                    const parts = vals.map((v) => {
                        if (KeyText[+v]) {
                            return KeyText[+v];
                        }
                        return +v;
                    });

                    // Join with + or return empty string if no parts
                    return [key, parts.join("+")];
                }),
            );
        },
    },
});

export const isHotkeysLoaded$ = observable(() => !!syncState(hotkeys$).isPersistLoaded.get());

export function getHotkey(name: HotkeyName): KeyboardEventCodeHotkey {
    return hotkeys$[name].get();
}

// Export metadata for use in UI
export function getHotkeyMetadata(name: HotkeyName) {
    return HotkeyMetadata[name];
}
