import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import type React from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { DragDropProvider } from "@/components/dnd";
import { MainContainer } from "@/components/MainContainer";
import { TitleBar } from "@/components/TitleBar";
import { MediaLibraryWindowManager } from "@/media-library/MediaLibraryWindowManager";
import { SettingsWindowManager } from "@/settings/SettingsWindowManager";
import { HookKeyboard } from "@/systems/keyboard/HookKeyboard";
import { initializeLocalMusic } from "@/systems/LocalMusicState";
import { initializeMenuManager } from "@/systems/MenuManager";
import { perfLog } from "@/utils/perfLogger";
import { ThemeProvider } from "./theme/ThemeProvider";

perfLog("App.initializeMenuManager");
initializeMenuManager();
perfLog("App.initializeLocalMusic.start");
initializeLocalMusic();
perfLog("App.initializeLocalMusic.end");

LogBox.ignoreLogs(["Open debugger", "unknown error"]);

function App(): React.JSX.Element | null {
    perfLog("App.render");
    return (
        <ThemeProvider>
            <HookKeyboard />
            <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
                <View className="flex-1 bg-background-primary/40">
                    <PortalProvider>
                        <DragDropProvider>
                            <MainContainer />
                        </DragDropProvider>
                    </PortalProvider>
                </View>
            </VibrancyView>
            <TitleBar />
            <MediaLibraryWindowManager />
            <SettingsWindowManager />
        </ThemeProvider>
    );
}

export default App;

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
    },
});
