import { use$ } from "@legendapp/state/react";
import { useEffect } from "react";
import { Dimensions } from "react-native";

import { useWindowManager, WindowStyleMask } from "@/native-modules/WindowManager";
import { perfCount, perfLog } from "@/utils/perfLogger";
import { WindowsNavigator } from "@/windows";

import { currentSongOverlay$, hideCurrentSongOverlay } from "./CurrentSongOverlayState";

const OVERLAY_WINDOW_KEY = "CurrentSongOverlayWindow" as const;
const OVERLAY_WINDOW_ID = WindowsNavigator.getIdentifier(OVERLAY_WINDOW_KEY);
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 140;
const TOP_MARGIN = 48;

export const CurrentSongOverlayWindowManager = () => {
    perfCount("CurrentSongOverlayWindowManager.render");
    const windowManager = useWindowManager();
    const isOpen = use$(currentSongOverlay$.isOpen);

    useEffect(() => {
        const subscription = windowManager.onWindowClosed(({ identifier }) => {
            if (identifier === OVERLAY_WINDOW_ID) {
                hideCurrentSongOverlay();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [windowManager]);

    useEffect(() => {
        perfLog("CurrentSongOverlayWindowManager.isOpenEffect", { isOpen });
        if (!isOpen) {
            void (async () => {
                try {
                    perfLog("CurrentSongOverlayWindowManager.closeWindow.start");
                    await WindowsNavigator.close(OVERLAY_WINDOW_KEY);
                } catch (error) {
                    console.error("Failed to close current song overlay window:", error);
                    perfLog("CurrentSongOverlayWindowManager.closeWindow.error", error);
                }
            })();
            return;
        }

        void (async () => {
            try {
                perfLog("CurrentSongOverlayWindowManager.openWindow.start");
                const screen = Dimensions.get("screen");
                const x = Math.round((screen.width - DEFAULT_WIDTH) / 2);
                const y = Math.max(TOP_MARGIN, 0);

                await WindowsNavigator.open(OVERLAY_WINDOW_KEY, {
                    x,
                    y,
                    windowStyle: {
                        width: DEFAULT_WIDTH,
                        height: DEFAULT_HEIGHT,
                        mask: [
                            WindowStyleMask.Borderless,
                            WindowStyleMask.NonactivatingPanel,
                            WindowStyleMask.FullSizeContentView,
                        ],
                    },
                });
            } catch (error) {
                console.error("Failed to open current song overlay window:", error);
                perfLog("CurrentSongOverlayWindowManager.openWindow.error", error);
            }
        })();
    }, [isOpen]);

    return null;
};

export const ensureOverlayWindowClosed = () => {
    hideCurrentSongOverlay();
};
