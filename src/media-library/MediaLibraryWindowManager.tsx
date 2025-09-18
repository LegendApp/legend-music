import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect } from "react";

import { useWindowManager } from "@/native-modules/WindowManager";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { libraryUI$ } from "@/systems/LibraryState";

const MEDIA_LIBRARY_WINDOW_ID = "media-library";
const MEDIA_LIBRARY_MODULE = "MediaLibraryWindow";
const MEDIA_LIBRARY_WIDTH = 420;
const WINDOW_GAP = 16;

export const MediaLibraryWindowManager = () => {
    const windowManager = useWindowManager();
    const isOpen = use$(libraryUI$.isOpen);

    const toggleLibrary = useCallback(() => {
        const current = libraryUI$.isOpen.get();
        libraryUI$.isOpen.set(!current);
    }, []);

    useOnHotkeys({
        ToggleLibrary: toggleLibrary,
    });

    useEffect(() => {
        const subscription = windowManager.onWindowClosed(({ identifier }) => {
            if (identifier === MEDIA_LIBRARY_WINDOW_ID) {
                libraryUI$.isOpen.set(false);
            }
        });

        return () => {
            subscription.remove();
        };
    }, [windowManager]);

    useEffect(() => {
        if (isOpen) {
            void (async () => {
                try {
                    const mainFrame = await windowManager.getMainWindowFrame();
                    const width = MEDIA_LIBRARY_WIDTH;
                    const height = mainFrame.height;
                    const x = mainFrame.x + mainFrame.width + WINDOW_GAP;
                    const y = mainFrame.y + (mainFrame.height - height);

                    await windowManager.openWindow({
                        identifier: MEDIA_LIBRARY_WINDOW_ID,
                        moduleName: MEDIA_LIBRARY_MODULE,
                        title: "Media Library",
                        width,
                        height,
                        x,
                        y,
                    });
                } catch (error) {
                    console.error("Failed to open media library window:", error);
                }
            })();
        } else {
            void (async () => {
                try {
                    const result = await windowManager.closeWindow(MEDIA_LIBRARY_WINDOW_ID);
                    if (!result.success && result.message !== "No window to close") {
                        console.warn("Media library window close reported:", result.message ?? "unknown issue");
                    }
                } catch (error) {
                    console.error("Failed to close media library window:", error);
                }
            })();
        }
    }, [isOpen, windowManager]);

    return null;
};
