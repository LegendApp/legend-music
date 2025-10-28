import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { use$, useObservable } from "@legendapp/state/react";
import { StyleSheet, View } from "react-native";

import { Sidebar } from "@/components/Sidebar";
import { AccountSettings } from "@/settings/AccountSettings";
import { GeneralSettings } from "@/settings/GeneralSettings";
import { LibrarySettings } from "@/settings/LibrarySettings";
import { OpenSourceSettings } from "@/settings/OpenSourceSettings";
import { state$ } from "@/systems/State";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { TooltipProvider } from "@/components/TooltipProvider";

export type SettingsPage = "general" | "library" | "account" | "open-source";

// Define the categories for settings
const SETTING_PAGES: { id: SettingsPage; name: string }[] = [
    { id: "general", name: "General" },
    { id: "library", name: "Library" },
    { id: "account", name: "Account" },
    { id: "open-source", name: "Open Source" },
];

export default function SettingsContainer() {
    const showSettingsPage = use$(state$.showSettingsPage);
    const selectedItem$ = useObservable<SettingsPage>(showSettingsPage || "general");
    const selectedItem = use$(selectedItem$);

    const renderContent = () => {
        switch (selectedItem) {
            case "general":
                return <GeneralSettings />;
            case "library":
                return <LibrarySettings />;
            case "open-source":
                return <OpenSourceSettings />;
            case "account":
                return <AccountSettings />;
            default:
                return null;
        }
    };

    return (
        <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
            <ThemeProvider>
                <PortalProvider>
                    <TooltipProvider>
                        <View className="flex flex-1 flex-row">
                            <Sidebar items={SETTING_PAGES} selectedItem$={selectedItem$} width={140} className="py-2" />
                            <View className="flex-1 bg-background-primary">{renderContent()}</View>
                        </View>
                    </TooltipProvider>
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
