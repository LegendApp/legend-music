import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { useCallback } from "react";
import type { LayoutChangeEvent } from "react-native";
import { StyleSheet, View } from "react-native";
import { DragDropProvider } from "@/components/dnd";
import { MediaLibraryView } from "@/components/MediaLibrary";
import { TooltipProvider } from "@/components/TooltipProvider";
import { HiddenTextInput } from "@/systems/keyboard/HookKeyboard";
import { stateSaved$ } from "@/systems/State";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { WindowProvider } from "@/windows";

const MEDIA_LIBRARY_WINDOW_ID = "media-library";

export default function MediaLibraryWindow() {
    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
            stateSaved$.libraryWindowSize.set({ width: Math.round(width), height: Math.round(height) });
        }
    }, []);

    console.log("ZZZ media window");

    return (
        <WindowProvider id={MEDIA_LIBRARY_WINDOW_ID}>
            <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
                <ThemeProvider>
                    <HiddenTextInput />
                    <PortalProvider>
                        <View className="flex-1 bg-background-primary/60 min-h-full" onLayout={handleLayout}>
                            <TooltipProvider>
                                <DragDropProvider>
                                    <MediaLibraryView />
                                </DragDropProvider>
                            </TooltipProvider>
                        </View>
                    </PortalProvider>
                </ThemeProvider>
            </VibrancyView>
        </WindowProvider>
    );
}

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
    },
});
