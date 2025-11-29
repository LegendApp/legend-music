import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { useMount } from "@legendapp/state/react";
import type React from "react";
import { useRef } from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { DragDropProvider } from "@/components/dnd";
import { MainContainer } from "@/components/MainContainer";
import { TitleBar } from "@/components/TitleBar";
import { ToastProvider } from "@/components/Toast";
import { TooltipProvider } from "@/components/TooltipProvider";
import { MediaLibraryWindowManager } from "@/media-library/MediaLibraryWindowManager";
import { CurrentSongOverlayController } from "@/overlay/CurrentSongOverlayController";
import { CurrentSongOverlayWindowManager } from "@/overlay/CurrentSongOverlayWindowManager";
import { SettingsWindowManager } from "@/settings/SettingsWindowManager";
import { HookKeyboard } from "@/systems/keyboard/HookKeyboard";
import { hydrateLibraryFromCache } from "@/systems/LibraryState";
import { initializeLocalMusic } from "@/systems/LocalMusicState";
import { initializeMenuManager } from "@/systems/MenuManager";
import { initializeUpdater } from "@/systems/Updater";
import { perfMark } from "@/utils/perfLogger";
import { runAfterInteractionsWithLabel } from "@/utils/runAfterInteractions";
import { VisualizerWindowManager } from "@/visualizer/VisualizerWindowManager";
import { WindowsNavigator } from "@/windows";
import { WindowProvider } from "@/windows/WindowProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

LogBox.ignoreLogs(["Open debugger", "unknown error"]);

perfMark("App.moduleLoad");
initializeUpdater();

function App(): React.JSX.Element | null {
    const hasLoggedFirstLayout = useRef(false);

    perfMark("App.render");
    useMount(() => {
        perfMark("App.useEffect");
        const initializeHandle = runAfterInteractionsWithLabel(() => {
            perfMark("App.initializeMenuManager");
            initializeMenuManager();
            perfMark("App.initializeLocalMusic.start");
            initializeLocalMusic();
            perfMark("App.initializeLocalMusic.end");
        }, "App.initializeMenuManager");

        const hydrateHandle = runAfterInteractionsWithLabel(() => {
            try {
                perfMark("App.hydrateLibrary.start");
                hydrateLibraryFromCache();
                perfMark("App.hydrateLibrary.end");
            } catch (error) {
                console.warn("Failed to hydrate library cache:", error);
            }
        }, "App.hydrateLibrary");

        const prefetchHandle = runAfterInteractionsWithLabel(() => {
            perfMark("App.prefetchWindows.start");
            void WindowsNavigator.prefetch("SettingsWindow").catch((error) => {
                console.warn("Failed to prefetch settings window:", error);
            });
            void WindowsNavigator.prefetch("MediaLibraryWindow").catch((error) => {
                console.warn("Failed to prefetch media library window:", error);
            });
            void WindowsNavigator.prefetch("CurrentSongOverlayWindow").catch((error) => {
                console.warn("Failed to prefetch current song overlay window:", error);
            });
            void WindowsNavigator.prefetch("VisualizerWindow").catch((error) => {
                console.warn("Failed to prefetch visualizer window:", error);
            });
            perfMark("App.prefetchWindows.end");
        }, "App.prefetchWindows");

        return () => {
            initializeHandle.cancel();
            hydrateHandle.cancel();
            prefetchHandle.cancel();
        };
    });

    const handleFirstLayout = () => {
        if (hasLoggedFirstLayout.current) {
            return;
        }
        hasLoggedFirstLayout.current = true;
        perfMark("App.firstLayout");
    };

    return (
        <WindowProvider id="main">
            <ThemeProvider>
                <HookKeyboard />
                <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
                    <View className="flex-1 bg-background-primary/40" onLayout={handleFirstLayout}>
                        <PortalProvider>
                            <ToastProvider />
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
                <CurrentSongOverlayController />
                <VisualizerWindowManager />
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
