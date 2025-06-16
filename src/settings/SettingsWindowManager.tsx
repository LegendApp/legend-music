import { useMountOnce } from "@legendapp/state/react";

import { useWindowManager, type WindowOptions } from "@/native-modules/WindowManager";
import { state$ } from "@/systems/State";

export const SettingsWindowManager = () => {
    const windowManager = useWindowManager();

    useMountOnce(() => {
        state$.showSettings.onChange(async ({ value }) => {
            if (value) {
                try {
                    const options: WindowOptions = {
                        title: "Settings",
                        width: 800,
                        height: 800,
                    };

                    await windowManager.openWindow(options);
                } catch (error) {
                    console.error("Failed to open window:", error);
                }
            } else {
                windowManager.closeWindow();
            }
        });

        const subscription = windowManager.onWindowClosed(() => {
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
