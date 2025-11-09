import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { useObserveEffect } from "@legendapp/state/react";
import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { PlaybackArea } from "@/components/PlaybackArea";
import { TooltipProvider } from "@/components/TooltipProvider";
import { setWindowBlur } from "@/native-modules/WindowManager";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { withWindowProvider } from "@/windows";

import {
    currentSongOverlay$,
    finalizeCurrentSongOverlayDismissal,
    pauseCurrentSongOverlayDismissal,
    resetCurrentSongOverlayTimer,
    setCurrentSongOverlayWindowHeight,
    setCurrentSongOverlayWindowWidth,
} from "./CurrentSongOverlayState";

import {
    OVERLAY_WINDOW_HIDE_DURATION_MS,
    OVERLAY_WINDOW_MAX_BLUR_RADIUS,
    OVERLAY_WINDOW_HEIGHT_COMPACT,
    OVERLAY_WINDOW_HEIGHT_EXPANDED,
    OVERLAY_WINDOW_INITIAL_SCALE,
    OVERLAY_WINDOW_ROOT_PADDING_BOTTOM,
    OVERLAY_WINDOW_ROOT_PADDING_TOP,
    OVERLAY_WINDOW_SHOW_DURATION_MS,
    OVERLAY_WINDOW_WIDTH_COMPACT,
    OVERLAY_WINDOW_WIDTH_EXPANDED,
} from "./OverlayConstants";

const WINDOW_ID = "current-song-overlay";
const styles = StyleSheet.create({
    root: {
        alignSelf: "stretch",
        flex: 1,
        paddingTop: OVERLAY_WINDOW_ROOT_PADDING_TOP,
        paddingHorizontal: 30,
        paddingBottom: OVERLAY_WINDOW_ROOT_PADDING_BOTTOM,
        backgroundColor: "transparent",
    },
    shadowContainer: {
        flex: 1,
        borderRadius: 20,
        backgroundColor: "#050505",
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        alignSelf: "stretch",
        width: "100%",
    },
    overlayWrapper: {
        flex: 1,
        borderRadius: 18,
        overflow: "hidden",
        alignSelf: "stretch",
        width: "100%",
    },
    overlaySurface: {
        flex: 1,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#AAABAB22",
        overflow: "hidden",
        alignSelf: "stretch",
        width: "100%",
    },
});

function CurrentSongOverlayWindow() {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(OVERLAY_WINDOW_INITIAL_SCALE);
    const [isHovered, setIsHovered] = useState(false);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    const handleExitComplete = useCallback(() => {
        finalizeCurrentSongOverlayDismissal();
    }, []);

    const handleMouseEnter = useCallback(() => {
        setIsHovered(true);
        pauseCurrentSongOverlayDismissal();
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsHovered(false);
        if (currentSongOverlay$.isExiting.peek()) {
            return;
        }
        resetCurrentSongOverlayTimer();
    }, []);

    useEffect(() => {
        const targetHeight = isHovered ? OVERLAY_WINDOW_HEIGHT_EXPANDED : OVERLAY_WINDOW_HEIGHT_COMPACT;
        const targetWidth = isHovered ? OVERLAY_WINDOW_WIDTH_EXPANDED : OVERLAY_WINDOW_WIDTH_COMPACT;
        setCurrentSongOverlayWindowHeight(targetHeight);
        setCurrentSongOverlayWindowWidth(targetWidth);
    }, [isHovered]);

    useObserveEffect(() => {
        const exiting = currentSongOverlay$.isExiting.get();
        const windowOpen = currentSongOverlay$.isWindowOpen.peek();

        if (exiting) {
            if (Platform.OS === "macos") {
                void (async () => {
                    try {
                        await setWindowBlur(WINDOW_ID, OVERLAY_WINDOW_MAX_BLUR_RADIUS, OVERLAY_WINDOW_HIDE_DURATION_MS);
                    } catch (error) {
                        console.error("Failed to animate overlay blur on hide:", error);
                    }
                })();
            }

            opacity.value = withTiming(
                0,
                {
                    duration: OVERLAY_WINDOW_HIDE_DURATION_MS,
                    easing: Easing.in(Easing.cubic),
                },
                (finished) => {
                    if (finished) {
                        runOnJS(handleExitComplete)();
                    }
                },
            );

            scale.value = withTiming(OVERLAY_WINDOW_INITIAL_SCALE, {
                duration: OVERLAY_WINDOW_HIDE_DURATION_MS,
                easing: Easing.in(Easing.cubic),
            });

            return;
        }

        if (!windowOpen) {
            return;
        }

        opacity.value = 0;
        scale.value = OVERLAY_WINDOW_INITIAL_SCALE;

        opacity.value = withTiming(1, {
            duration: OVERLAY_WINDOW_SHOW_DURATION_MS,
            easing: Easing.out(Easing.cubic),
        });

        scale.value = withTiming(1, {
            duration: OVERLAY_WINDOW_SHOW_DURATION_MS,
            easing: Easing.out(Easing.cubic),
        });

        if (Platform.OS === "macos") {
            void (async () => {
                try {
                    await setWindowBlur(WINDOW_ID, OVERLAY_WINDOW_MAX_BLUR_RADIUS, 0);
                    await setWindowBlur(WINDOW_ID, 0, OVERLAY_WINDOW_SHOW_DURATION_MS);
                } catch (error) {
                    console.error("Failed to animate overlay blur on show:", error);
                }
            })();
        }
    });

    return (
        <Animated.View
            style={[styles.root, animatedStyle]}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <Animated.View style={styles.shadowContainer}>
                <View style={styles.overlayWrapper}>
                    <VibrancyView
                        blendingMode="behindWindow"
                        material="hudWindow"
                        state="active"
                        style={styles.overlaySurface}
                    >
                        <View className="flex-1 bg-background-primary/40">
                            <ThemeProvider>
                                <PortalProvider>
                                    <TooltipProvider>
                                        <PlaybackArea
                                            showBorder={false}
                                            overlayMode={{ enabled: true, showControls: isHovered }}
                                        />
                                    </TooltipProvider>
                                </PortalProvider>
                            </ThemeProvider>
                        </View>
                    </VibrancyView>
                </View>
            </Animated.View>
        </Animated.View>
    );
}

export default withWindowProvider(CurrentSongOverlayWindow, WINDOW_ID);
