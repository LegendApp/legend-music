import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { StyleSheet, View } from "react-native";
import { DragDropProvider } from "@/components/dnd";
import { MediaLibraryView } from "@/components/MediaLibrary";
import { TooltipProvider } from "@/components/TooltipProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

export default function MediaLibraryWindow() {
    return (
        <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
            <ThemeProvider>
                <PortalProvider>
                    <View className="flex-1 bg-background-primary/60 min-h-full">
                        <TooltipProvider>
                            <DragDropProvider>
                                <MediaLibraryView />
                            </DragDropProvider>
                        </TooltipProvider>
                    </View>
                </PortalProvider>
            </ThemeProvider>
        </VibrancyView>
    );
}

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
    },
});
