import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { PlaybackArea } from "@/components/PlaybackArea";
import { TooltipProvider } from "@/components/TooltipProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { withWindowProvider } from "@/windows";

import { currentSongOverlay$, finalizeCurrentSongOverlayDismissal } from "./CurrentSongOverlayState";

const WINDOW_ID = "current-song-overlay";

const styles = StyleSheet.create({
    root: {
        alignSelf: "stretch",
        flex: 1,
        paddingTop: 22,
        paddingHorizontal: 30,
        paddingBottom: 36,
        backgroundColor: "transparent",
    },
    shadowContainer: {
        flex: 1,
        borderRadius: 20,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        overflow: "hidden",
    },
    overlaySurface: {
        flex: 1,
        borderRadius: 18,
        overflow: "hidden",
    },
});

function CurrentSongOverlayWindow() {
    const presentationId = use$(currentSongOverlay$.presentationId);
    const isExiting = use$(currentSongOverlay$.isExiting);

    const opacity = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const handleExitComplete = useCallback(() => {
        finalizeCurrentSongOverlayDismissal();
    }, []);

    useEffect(() => {
        opacity.value = 0;

        opacity.value = withTiming(1, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
        });
    }, [presentationId, opacity]);

    useEffect(() => {
        if (!isExiting) {
            return;
        }

        opacity.value = withTiming(
            0,
            {
                duration: 220,
                easing: Easing.in(Easing.cubic),
            },
            (finished) => {
                if (finished) {
                    runOnJS(handleExitComplete)();
                }
            },
        );
    }, [isExiting, opacity, handleExitComplete]);

    return (
        <Animated.View style={[styles.root, animatedStyle]}>
            <View style={styles.shadowContainer}>
                <VibrancyView
                    blendingMode="behindWindow"
                    material="hudWindow"
                    state="active"
                    style={styles.overlaySurface}
                >
                    <ThemeProvider>
                        <PortalProvider>
                            <TooltipProvider>
                                <PlaybackArea showBorder={false} />
                            </TooltipProvider>
                        </PortalProvider>
                    </ThemeProvider>
                </VibrancyView>
            </View>
        </Animated.View>
    );
}

export default withWindowProvider(CurrentSongOverlayWindow, WINDOW_ID);
