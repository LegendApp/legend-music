import { useObserveEffect } from "@legendapp/state/react";
import { useCallback, useEffect } from "react";
import { Dimensions } from "react-native";

import { mediaLibraryPreferences$ } from "@/media-library/preferences";
import { useWindowManager } from "@/native-modules/WindowManager";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { stateSaved$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";
import { WindowsNavigator } from "@/windows";

const MEDIA_LIBRARY_WINDOW_KEY = "MediaLibraryWindow" as const;
const MEDIA_LIBRARY_WINDOW_ID = WindowsNavigator.getIdentifier(MEDIA_LIBRARY_WINDOW_KEY);
const MEDIA_LIBRARY_WIDTH = 420;
const MEDIA_LIBRARY_MIN_WIDTH = 360;
const MEDIA_LIBRARY_MIN_HEIGHT = 400;
const MEDIA_LIBRARY_DEFAULT_HEIGHT = 600;
const WINDOW_GAP = 16;

const clamp = (value: number, min: number, max: number) => {
    if (Number.isNaN(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
};

export const MediaLibraryWindowManager = () => {
    perfCount("MediaLibraryWindowManager.render");
    const windowManager = useWindowManager();

    const toggleLibrary = useCallback(() => {
        perfLog("MediaLibraryWindowManager.toggleLibrary", { isOpen: stateSaved$.libraryIsOpen.get() });
        const current = stateSaved$.libraryIsOpen.get();
        stateSaved$.libraryIsOpen.set(!current);
    }, []);

    useOnHotkeys({
        ToggleLibrary: toggleLibrary,
    });

    useEffect(() => {
        perfLog("MediaLibraryWindowManager.windowClosedEffect");
        const subscription = windowManager.onWindowClosed(({ identifier }) => {
            if (identifier === MEDIA_LIBRARY_WINDOW_ID) {
                stateSaved$.libraryIsOpen.set(false);
            }
        });

        return () => {
            subscription.remove();
        };
    }, [windowManager]);

    useObserveEffect(() => {
        const isOpen = stateSaved$.libraryIsOpen.get();
        perfLog("MediaLibraryWindowManager.isOpenEffect", { isOpen });
        if (isOpen) {
            (async () => {
                try {
                    perfLog("MediaLibraryWindowManager.openWindow.start");
                    const mainFrame = await windowManager.getMainWindowFrame();
                    const screen = Dimensions.get("screen");
                    const storedSize = mediaLibraryPreferences$.window.get();
                    const preferredWidth = storedSize.width > 0 ? storedSize.width : MEDIA_LIBRARY_WIDTH;
                    const preferredHeight =
                        storedSize.height > 0
                            ? storedSize.height
                            : Math.max(mainFrame.height, MEDIA_LIBRARY_DEFAULT_HEIGHT);
                    const maxWidth = Math.max(screen.width - WINDOW_GAP, MEDIA_LIBRARY_MIN_WIDTH);
                    const maxHeight = Math.max(screen.height - WINDOW_GAP, MEDIA_LIBRARY_MIN_HEIGHT);
                    const width = clamp(Math.floor(preferredWidth), MEDIA_LIBRARY_MIN_WIDTH, maxWidth);
                    const height = clamp(Math.floor(preferredHeight), MEDIA_LIBRARY_MIN_HEIGHT, maxHeight);
                    const fitsOnRight = mainFrame.x + mainFrame.width + WINDOW_GAP + width <= screen.width;
                    const x = fitsOnRight
                        ? mainFrame.x + mainFrame.width + WINDOW_GAP
                        : Math.max(mainFrame.x - WINDOW_GAP - width, 0);
                    const y = Math.max(mainFrame.y + (mainFrame.height - height), 0);

                    await WindowsNavigator.open(MEDIA_LIBRARY_WINDOW_KEY, {
                        x,
                        y,
                        windowStyle: {
                            width,
                            height,
                        },
                    });
                } catch (error) {
                    console.error("Failed to open media library window:", error);
                    perfLog("MediaLibraryWindowManager.openWindow.error", error);
                }
            })();
        } else {
            (async () => {
                try {
                    perfLog("MediaLibraryWindowManager.closeWindow.start");
                    await WindowsNavigator.close(MEDIA_LIBRARY_WINDOW_KEY);
                } catch (error) {
                    console.error("Failed to close media library window:", error);
                    perfLog("MediaLibraryWindowManager.closeWindow.error", error);
                }
            })();
        }
    });

    return null;
};
