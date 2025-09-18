import { useMountOnce } from "@legendapp/state/react";

import { useWindowManager, type WindowOptions } from "@/native-modules/WindowManager";
import { state$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";

const SETTINGS_WINDOW_ID = "settings";

export const SettingsWindowManager = () => {
    const windowManager = useWindowManager();

    useMountOnce(() => {
        perfLog("SettingsWindowManager.mount");
        state$.showSettings.onChange(async ({ value }) => {
            perfLog("SettingsWindowManager.showSettingsChange", { value });
            if (value) {
                try {
                    const options: WindowOptions = {
                        identifier: SETTINGS_WINDOW_ID,
                        moduleName: "SettingsWindow",
                        title: "Settings",
                        width: 800,
                        height: 800,
                    };

                    await windowManager.openWindow(options);
                } catch (error) {
                    console.error("Failed to open window:", error);
                    perfLog("SettingsWindowManager.openWindow.error", error);
                }
            } else {
                try {
                    await windowManager.closeWindow(SETTINGS_WINDOW_ID);
                } catch (error) {
                    console.error("Failed to close settings window:", error);
                    perfLog("SettingsWindowManager.closeWindow.error", error);
                }
            }
        });

        const subscription = windowManager.onWindowClosed(({ identifier }) => {
            perfCount("SettingsWindowManager.windowClosedEvent");
            if (identifier !== SETTINGS_WINDOW_ID) {
                return;
            }

            state$.assign({
                showSettings: false,
                showSettingsPage: undefined,
            });
        });

        return () => {
            subscription.remove();
        };
    });

    return null;
};
