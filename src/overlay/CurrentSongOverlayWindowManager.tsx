import { use$ } from "@legendapp/state/react";
import { useEffect } from "react";
import { Dimensions } from "react-native";

import { useWindowManager, WindowStyleMask } from "@/native-modules/WindowManager";
import { perfCount, perfLog } from "@/utils/perfLogger";
import { WindowsNavigator } from "@/windows";

import {
    cancelCurrentSongOverlay,
    currentSongOverlay$,
    finalizeCurrentSongOverlayDismissal,
} from "./CurrentSongOverlayState";

const OVERLAY_WINDOW_KEY = "CurrentSongOverlayWindow" as const;
const OVERLAY_WINDOW_ID = WindowsNavigator.getIdentifier(OVERLAY_WINDOW_KEY);
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 140;
const TOP_MARGIN = 48;

export const CurrentSongOverlayWindowManager = () => {
    perfCount("CurrentSongOverlayWindowManager.render");
    const windowManager = useWindowManager();
    const isWindowOpen = use$(currentSongOverlay$.isWindowOpen);

    useEffect(() => {
        const subscription = windowManager.onWindowClosed(({ identifier }) => {
            if (identifier === OVERLAY_WINDOW_ID) {
                finalizeCurrentSongOverlayDismissal();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [windowManager]);

    useEffect(() => {
        perfLog("CurrentSongOverlayWindowManager.isOpenEffect", { isWindowOpen });
        if (!isWindowOpen) {
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
                const windowDims = Dimensions.get("window");
                const screenWidth =
                    typeof screen?.width === "number"
                        ? screen.width
                        : typeof windowDims?.width === "number"
                          ? windowDims.width
                          : DEFAULT_WIDTH;
                const x = Math.max(Math.round((screenWidth - DEFAULT_WIDTH) / 2), 0);
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
    }, [isWindowOpen]);

    return null;
};

export const ensureOverlayWindowClosed = () => {
    cancelCurrentSongOverlay();
};
