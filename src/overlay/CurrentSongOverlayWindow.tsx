import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
    Easing,
    interpolateColor,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { PlaybackArea } from "@/components/PlaybackArea";
import { TooltipProvider } from "@/components/TooltipProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { withWindowProvider } from "@/windows";

import {
    currentSongOverlay$,
    finalizeCurrentSongOverlayDismissal,
} from "./CurrentSongOverlayState";

const WINDOW_ID = "current-song-overlay";

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
    },
    overlaySurface: {
        alignSelf: "stretch",
    },
});

function CurrentSongOverlayWindow() {
    const presentationId = use$(currentSongOverlay$.presentationId);
    const isExiting = use$(currentSongOverlay$.isExiting);

    const opacity = useSharedValue(0);
    const translateY = useSharedValue(-16);
    const blurAmount = useSharedValue(16);

    const animatedStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            blurAmount.value,
            [0, 16],
            ["rgba(18, 18, 21, 0.78)", "rgba(18, 18, 21, 0.92)"],
        );

        return {
            opacity: opacity.value,
            transform: [{ translateY: translateY.value }],
            backgroundColor,
        };
    });

    const handleExitComplete = useCallback(() => {
        finalizeCurrentSongOverlayDismissal();
    }, []);

    useEffect(() => {
        opacity.value = 0;
        translateY.value = -16;
        blurAmount.value = 16;

        opacity.value = withTiming(1, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
        });
        translateY.value = withTiming(0, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
        });
        blurAmount.value = withTiming(0, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
        });
    }, [presentationId, opacity, translateY, blurAmount]);

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
        translateY.value = withTiming(-18, {
            duration: 220,
            easing: Easing.in(Easing.cubic),
        });
        blurAmount.value = withTiming(16, {
            duration: 220,
            easing: Easing.in(Easing.cubic),
        });
    }, [isExiting, blurAmount, opacity, translateY, handleExitComplete]);

    return (
        <VibrancyView blendingMode="behindWindow" material="menu" style={styles.vibrancy}>
            <ThemeProvider>
                <PortalProvider>
                    <TooltipProvider>
                        <Animated.View style={[styles.overlaySurface, animatedStyle]}>
                            <PlaybackArea />
                        </Animated.View>
                    </TooltipProvider>
                </PortalProvider>
            </ThemeProvider>
        </VibrancyView>
    );
}

export default withWindowProvider(CurrentSongOverlayWindow, WINDOW_ID);
