import "@/../global.css";
import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import type React from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { MainContainer } from "@/components/MainContainer";
import { SettingsWindowManager } from "@/settings/SettingsWindowManager";
import { initializeMenuManager } from "@/systems/MenuManager";
import { ThemeProvider } from "./theme/ThemeProvider";

initializeMenuManager();

LogBox.ignoreLogs(["Open debugger", "unknown error"]);

function App(): React.JSX.Element | null {

    return (
        <ThemeProvider>
            <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
                <View className="flex-1">
                    <PortalProvider>
                        <MainContainer />
                    </PortalProvider>
                </View>
            </VibrancyView>
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
