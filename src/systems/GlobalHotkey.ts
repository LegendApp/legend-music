import { observable } from "@legendapp/state";
import { useMount, useObserveEffect } from "@legendapp/state/react";
import { useRef } from "react";
import { Platform } from "react-native";
import { onGlobalHotkey, registerGlobalHotkey, unregisterGlobalHotkey } from "@/native-modules/GlobalHotkey";
import { useWindowManager } from "@/native-modules/WindowManager";
import { settings$ } from "@/systems/Settings";

export const globalHotkeyStatus$ = observable({
    error: null as string | null,
});

const clearError = () => {
    globalHotkeyStatus$.error.set(null);
};

const setError = (message: string | undefined) => {
    globalHotkeyStatus$.error.set(message || "Failed to register global hotkey.");
};

export function GlobalHotkeyManager() {
    const windowManagerRef = useRef(useWindowManager());

    useObserveEffect(() => {
        const enabled = settings$.general.globalHotkeyEnabled.get();
        const hotkey = settings$.general.globalHotkey.get();

        if (!enabled) {
            void unregisterGlobalHotkey().then(clearError);
            return;
        }

        void registerGlobalHotkey(hotkey).then((result) => {
            if (result.success) {
                clearError();
            } else {
                setError(result.message);
            }
        });
    });

    useMount(() => {
        if (Platform.OS !== "macos") {
            return;
        }

        const subscription = onGlobalHotkey(() => {
            void windowManagerRef.current.showMainWindow();
        });

        return () => {
            subscription.remove();
            void unregisterGlobalHotkey();
        };
    });

    return null;
}
