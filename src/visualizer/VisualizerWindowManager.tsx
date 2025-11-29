import { observable } from "@legendapp/state";
import { useMount, useObserveEffect } from "@legendapp/state/react";

import { useWindowManager } from "@/native-modules/WindowManager";
import { perfLog } from "@/utils/perfLogger";
import { visualizerPreferences$ } from "@/visualizer/preferences";
import { WindowsNavigator } from "@/windows";

const VISUALIZER_WINDOW_KEY = "VisualizerWindow" as const;
const VISUALIZER_WINDOW_ID = WindowsNavigator.getIdentifier(VISUALIZER_WINDOW_KEY);

export const visualizerWindowState$ = observable({
    isOpen: false,
});

export function toggleVisualizerWindow() {
    const current = visualizerWindowState$.isOpen.get();
    perfLog("VisualizerWindowManager.toggle", { current });
    visualizerWindowState$.isOpen.set(!current);
}

export const VisualizerWindowManager = () => {
    const windowManager = useWindowManager();

    useMount(() => {
        const subscription = windowManager.onWindowClosed(({ identifier }) => {
            if (identifier === VISUALIZER_WINDOW_ID) {
                visualizerWindowState$.isOpen.set(false);
            }
        });

        return () => {
            subscription.remove();
        };
    });

    useObserveEffect(() => {
        if (visualizerWindowState$.isOpen.get()) {
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
    });

    return null;
};

export default VisualizerWindowManager;
