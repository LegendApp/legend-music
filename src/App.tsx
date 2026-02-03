import "@/../global.css";
import { PortalProvider } from "@gorhom/portal";
import { useMount } from "@legendapp/state/react";
import type React from "react";
import { useCallback, useRef } from "react";
import { LogBox, type LayoutChangeEvent, View } from "react-native";
import { DragDropProvider } from "@/components/dnd";
import { EffectView } from "@/components/EffectView";
import { MainContainer } from "@/components/MainContainer";
import { TitleBar } from "@/components/TitleBar";
import { ToastProvider } from "@/components/Toast";
import { TooltipProvider } from "@/components/TooltipProvider";
import { MediaLibraryWindowManager } from "@/media-library/MediaLibraryWindowManager";
import { CurrentSongOverlayController } from "@/overlay/CurrentSongOverlayController";
import { CurrentSongOverlayWindowManager } from "@/overlay/CurrentSongOverlayWindowManager";
import { getStreamingProviderPlugins } from "@/providers/pluginRegistry";
import { ensureStreamingProvidersRegistered, initializeStreamingProviderPlugins } from "@/providers/setupProviders";
import { SettingsWindowManager } from "@/settings/SettingsWindowManager";
import { initializeAiAvailability } from "@/systems/ai";
import { IS_TAHOE } from "@/systems/constants";
import { GlobalHotkeyManager } from "@/systems/GlobalHotkey";
import { HookKeyboard } from "@/systems/keyboard/HookKeyboard";
import { hydrateLibraryFromCache } from "@/systems/LibraryState";
import { initializeMenuManager } from "@/systems/MenuManager";
import { initializeUpdater } from "@/systems/Updater";
import { perfMark } from "@/utils/perfLogger";
import { runAfterInteractionsWithLabel } from "@/utils/runAfterInteractions";
import { VisualizerWindowManager } from "@/visualizer/VisualizerWindowManager";
import { WindowsNavigator } from "@/windows";
import { WindowProvider } from "@/windows/WindowProvider";
import { useWindowLayoutReporter } from "@/windows/windowDimensions";
import { ThemeProvider } from "./theme/ThemeProvider";

LogBox.ignoreLogs(["Open debugger", "unknown error", "re-registered bubbling event"]);

perfMark("App.moduleLoad");
initializeUpdater();
ensureStreamingProvidersRegistered();

type MainWindowLayoutProps = {
    className?: string;
    children: React.ReactNode;
};

function MainWindowLayout({ className, children }: MainWindowLayoutProps) {
    const hasLoggedFirstLayout = useRef(false);
    const reportWindowLayout = useWindowLayoutReporter();

    const handleFirstLayout = useCallback(
        (event: LayoutChangeEvent) => {
            reportWindowLayout(event);
            if (hasLoggedFirstLayout.current) {
                return;
            }
            hasLoggedFirstLayout.current = true;
            perfMark("App.firstLayout");
        },
        [reportWindowLayout],
    );

    return (
        <View className={className} onLayout={handleFirstLayout}>
            {children}
        </View>
    );
}

function App(): React.JSX.Element | null {
    const providerBridges = getStreamingProviderPlugins()
        .map((plugin) => {
            const Bridge = plugin.ui?.bridge;
            return Bridge ? <Bridge key={`provider-bridge-${plugin.provider.id}`} /> : null;
        })
        .filter(Boolean);

    perfMark("App.render");
    useMount(() => {
        perfMark("App.useEffect");
        ensureStreamingProvidersRegistered();
        const initializeHandle = runAfterInteractionsWithLabel(() => {
            perfMark("App.initializeMenuManager");
            initializeMenuManager();
            void (async () => {
                perfMark("App.initializeProviders.start");
                try {
                    await initializeStreamingProviderPlugins({ reason: "app-start" });
                } catch (error) {
                    console.error("Failed to initialize provider plugins:", error);
                } finally {
                    perfMark("App.initializeProviders.end");
                }
            })();
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

        const aiHandle = runAfterInteractionsWithLabel(() => {
            initializeAiAvailability();
        }, "App.initializeAiAvailability");

        return () => {
            initializeHandle.cancel();
            hydrateHandle.cancel();
            prefetchHandle.cancel();
            aiHandle.cancel();
        };
    });

    const contentClassName = IS_TAHOE ? "flex-1" : "flex-1 bg-background-primary/40";
    const content = (
        <MainWindowLayout className={contentClassName}>
            <PortalProvider>
                <ToastProvider />
                <TooltipProvider>
                    <DragDropProvider>
                        <MainContainer />
                    </DragDropProvider>
                </TooltipProvider>
                {providerBridges}
            </PortalProvider>
        </MainWindowLayout>
    );

    return (
        <WindowProvider id="main">
            <ThemeProvider>
                <HookKeyboard />
                <GlobalHotkeyManager />
                <EffectView glassStyle="regular" style={{ flex: 1 }}>
                    {content}
                </EffectView>
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
