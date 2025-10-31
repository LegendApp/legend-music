import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import type React from "react";
import { useEffect } from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { DragDropProvider } from "@/components/dnd";
import { MainContainer } from "@/components/MainContainer";
import { TitleBar } from "@/components/TitleBar";
import { TooltipProvider } from "@/components/TooltipProvider";
import { MediaLibraryWindowManager } from "@/media-library/MediaLibraryWindowManager";
import { CurrentSongOverlayWindowManager } from "@/overlay/CurrentSongOverlayWindowManager";
import { SettingsWindowManager } from "@/settings/SettingsWindowManager";
import { HookKeyboard } from "@/systems/keyboard/HookKeyboard";
import { hydrateLibraryFromCache } from "@/systems/LibraryState";
import { initializeLocalMusic } from "@/systems/LocalMusicState";
import { initializeMenuManager } from "@/systems/MenuManager";
import { perfLog } from "@/utils/perfLogger";
import { runAfterInteractions } from "@/utils/runAfterInteractions";
import { WindowsNavigator } from "@/windows";
import { WindowProvider } from "@/windows/WindowProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

LogBox.ignoreLogs(["Open debugger", "unknown error"]);

function App(): React.JSX.Element | null {
    perfLog("App.render");
    useEffect(() => {
        const initializeHandle = runAfterInteractions(() => {
            perfLog("App.initializeMenuManager");
            initializeMenuManager();
            perfLog("App.initializeLocalMusic.start");
            initializeLocalMusic();
            perfLog("App.initializeLocalMusic.end");
        });

        const hydrateHandle = runAfterInteractions(() => {
            try {
                hydrateLibraryFromCache();
            } catch (error) {
                console.warn("Failed to hydrate library cache:", error);
            }
        });

        const prefetchHandle = runAfterInteractions(() => {
            void WindowsNavigator.prefetch("SettingsWindow").catch((error) => {
                console.warn("Failed to prefetch settings window:", error);
            });
            void WindowsNavigator.prefetch("MediaLibraryWindow").catch((error) => {
                console.warn("Failed to prefetch media library window:", error);
            });
        });

        return () => {
            initializeHandle.cancel();
            hydrateHandle.cancel();
            prefetchHandle.cancel();
        };
    }, []);

    return (
        <WindowProvider id="main">
            <ThemeProvider>
                <HookKeyboard />
                <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
                    <View className="flex-1 bg-background-primary/40">
                        <PortalProvider>
                            <TooltipProvider>
                                <DragDropProvider>
                                    <MainContainer />
                                </DragDropProvider>
                            </TooltipProvider>
                        </PortalProvider>
                    </View>
                </VibrancyView>
                <TitleBar />
                <MediaLibraryWindowManager />
                <SettingsWindowManager />
                <CurrentSongOverlayWindowManager />
            </ThemeProvider>
        </WindowProvider>
    );
}

export default App;

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
    },
});
