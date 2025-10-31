import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { PlaybackArea } from "@/components/PlaybackArea";
import { TooltipProvider } from "@/components/TooltipProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { withWindowProvider } from "@/windows";

import { currentSongOverlay$, finalizeCurrentSongOverlayDismissal } from "./CurrentSongOverlayState";

const WINDOW_ID = "current-song-overlay";

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
        borderRadius: 20,
        overflow: "hidden",
    },
    overlaySurface: {
        alignSelf: "stretch",
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "transparent",
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
        <VibrancyView
            blendingMode="behindWindow"
            material="hudWindow"
            state="active"
            style={styles.vibrancy}
        >
            <ThemeProvider>
                <PortalProvider>
                    <TooltipProvider>
                        <Animated.View style={[styles.overlaySurface, animatedStyle]}>
                            <PlaybackArea showBorder={false} />
                        </Animated.View>
                    </TooltipProvider>
                </PortalProvider>
            </ThemeProvider>
        </VibrancyView>
    );
}

export default withWindowProvider(CurrentSongOverlayWindow, WINDOW_ID);
