import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { use$, useObservable } from "@legendapp/state/react";
import { StyleSheet, View } from "react-native";

import { Sidebar } from "@/components/Sidebar";
import { AccountSettings } from "@/settings/AccountSettings";
import { RepositoriesSettings } from "@/settings/RepositoriesSettings";
import { state$ } from "@/systems/State";
import { ThemeProvider } from "@/theme/ThemeProvider";

export type SettingsPage = "account" | "repositories";

// Define the categories for settings
const SETTING_PAGES: { id: SettingsPage; name: string }[] = [
    //   { id: 'general', label: 'General' },
    { id: "account", name: "Account" },
    { id: "repositories", name: "Repositories" },
    // { type: 'item', path: 'themes', text: 'Themes' },
    //   { id: 'plugins', label: 'Plugins' },
    // Add more categories as needed
];

export const SettingsContainer = () => {
    const showSettingsPage = use$(state$.showSettingsPage);
    const selectedItem$ = useObservable<SettingsPage>(showSettingsPage || "account");
    const selectedItem = use$(selectedItem$);

    const renderContent = () => {
        switch (selectedItem) {
            case "account":
                return <AccountSettings />;
            case "repositories":
                return <RepositoriesSettings />;
            //     return <ThemeSettings />;
            // case 'plugins':
            //     return <PluginSettings />;
            // case 'library':
            //     return <LibrarySettings />;
            // default:
            //     return <AccountSettings />;
        }
    };

    return (
        <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
            <ThemeProvider>
                <PortalProvider>
                    <View className="flex flex-1 flex-row">
                        <Sidebar items={SETTING_PAGES} selectedItem$={selectedItem$} width={140} className="py-2" />
                        <View className="flex-1 bg-background-primary">{renderContent()}</View>
                    </View>
                </PortalProvider>
            </ThemeProvider>
        </VibrancyView>
    );
};

const styles = StyleSheet.create({
    vibrancy: {
        flex: 1,
    },
});
