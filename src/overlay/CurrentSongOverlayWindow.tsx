import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { StyleSheet, View } from "react-native";

import { PlaybackArea } from "@/components/PlaybackArea";
import { TooltipProvider } from "@/components/TooltipProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { withWindowProvider } from "@/windows";

const WINDOW_ID = "current-song-overlay";

function CurrentSongOverlayWindow() {
    return (
        <VibrancyView blendingMode="behindWindow" material="menu" style={styles.vibrancy}>
            <ThemeProvider>
                <PortalProvider>
                    <TooltipProvider>
                        <View className="min-h-full bg-background-primary/80">
                            <PlaybackArea />
                        </View>
                    </TooltipProvider>
                </PortalProvider>
            </ThemeProvider>
        </VibrancyView>
    );
}

export default withWindowProvider(CurrentSongOverlayWindow, WINDOW_ID);

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
    },
});
