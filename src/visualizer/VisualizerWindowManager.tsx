import { observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect } from "react";

import { localPlayerState$ } from "@/components/LocalAudioPlayer";
import { useWindowManager } from "@/native-modules/WindowManager";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { perfLog } from "@/utils/perfLogger";
import { visualizerPreferences$ } from "@/visualizer/preferences";
import { WindowsNavigator } from "@/windows";

const VISUALIZER_WINDOW_KEY = "VisualizerWindow" as const;
const VISUALIZER_WINDOW_ID = WindowsNavigator.getIdentifier(VISUALIZER_WINDOW_KEY);

const visualizerWindowState$ = observable({
    isOpen: false,
});

export const VisualizerWindowManager = () => {
    const windowManager = useWindowManager();
    const isOpen = use$(visualizerWindowState$.isOpen);
    const autoClose = use$(visualizerPreferences$.window.autoClose);
    const isPlaying = use$(localPlayerState$.isPlaying);

    const toggleVisualizer = useCallback(() => {
        const current = visualizerWindowState$.isOpen.get();
        perfLog("VisualizerWindowManager.toggle", { current });
        visualizerWindowState$.isOpen.set(!current);
    }, []);

    // useEffect(() => {
    //     visualizerWindowState$.isOpen.set(true);
    // }, []);

    useOnHotkeys(
        {
            ToggleVisualizer: toggleVisualizer,
            ToggleVisualizerZ: toggleVisualizer,
            ToggleVisualizerI: toggleVisualizer,
        },
        { global: true },
    );

    useEffect(() => {
        const subscription = windowManager.onWindowClosed(({ identifier }) => {
            if (identifier === VISUALIZER_WINDOW_ID) {
                visualizerWindowState$.isOpen.set(false);
            }
        });

        return () => {
            subscription.remove();
        };
    }, [windowManager]);

    useEffect(() => {
        console.log("vis window manager open", isOpen);
        if (isOpen) {
            (async () => {
                const { window } = visualizerPreferences$.get();
                const width = Math.max(480, Math.floor(window.width) || 780);
                const height = Math.max(320, Math.floor(window.height) || 420);

                try {
                    await WindowsNavigator.open(VISUALIZER_WINDOW_KEY, {
                        windowStyle: {
                            width,
                            height,
                        },
                    });
                } catch (error) {
                    console.error("Failed to open visualizer window:", error);
                    visualizerWindowState$.isOpen.set(false);
                }
            })();
        } else {
            (async () => {
                try {
                    await WindowsNavigator.close(VISUALIZER_WINDOW_KEY);
                } catch (error) {
                    perfLog("VisualizerWindowManager.close.error", error);
                }
            })();
        }
    }, [isOpen]);

    // useEffect(() => {
    //     if (!isPlaying && autoClose && visualizerWindowState$.isOpen.get()) {
    //         visualizerWindowState$.isOpen.set(false);
    //     }
    // }, [autoClose, isPlaying]);

    return null;
};

export default VisualizerWindowManager;
