import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect } from "react";

import { useWindowManager } from "@/native-modules/WindowManager";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { libraryUI$ } from "@/systems/LibraryState";
import { perfCount, perfLog } from "@/utils/perfLogger";

const MEDIA_LIBRARY_WINDOW_ID = "media-library";
const MEDIA_LIBRARY_MODULE = "MediaLibraryWindow";
const MEDIA_LIBRARY_WIDTH = 420;
const WINDOW_GAP = 16;

export const MediaLibraryWindowManager = () => {
    perfCount("MediaLibraryWindowManager.render");
    const windowManager = useWindowManager();
    const isOpen = use$(libraryUI$.isOpen);

    const toggleLibrary = useCallback(() => {
        perfLog("MediaLibraryWindowManager.toggleLibrary", { isOpen: libraryUI$.isOpen.get() });
        const current = libraryUI$.isOpen.get();
        libraryUI$.isOpen.set(!current);
    }, []);

    useOnHotkeys({
        ToggleLibrary: toggleLibrary,
    });

    useEffect(() => {
        perfLog("MediaLibraryWindowManager.windowClosedEffect");
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
        perfLog("MediaLibraryWindowManager.isOpenEffect", { isOpen });
        if (isOpen) {
            void (async () => {
                try {
                    perfLog("MediaLibraryWindowManager.openWindow.start");
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
                    perfLog("MediaLibraryWindowManager.openWindow.error", error);
                }
            })();
        } else {
            void (async () => {
                try {
                    perfLog("MediaLibraryWindowManager.closeWindow.start");
                    const result = await windowManager.closeWindow(MEDIA_LIBRARY_WINDOW_ID);
                    if (!result.success && result.message !== "No window to close") {
                        console.warn("Media library window close reported:", result.message ?? "unknown issue");
                    }
                } catch (error) {
                    console.error("Failed to close media library window:", error);
                    perfLog("MediaLibraryWindowManager.closeWindow.error", error);
                }
            })();
        }
    }, [isOpen, windowManager]);

    return null;
};
