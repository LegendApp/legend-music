import { VibrancyView } from "@fluentui-react-native/vibrancy-view";
import { PortalProvider } from "@gorhom/portal";
import { useObservable, useValue } from "@legendapp/state/react";
import type { ComponentType } from "react";
import { StyleSheet } from "react-native";
import { Sidebar } from "@/components/Sidebar";
import { TooltipProvider } from "@/components/TooltipProvider";
import { AccountSettings } from "@/settings/AccountSettings";
import { CustomizeUISettings } from "@/settings/CustomizeUISettings";
import { GeneralSettings } from "@/settings/GeneralSettings";
import { LibrarySettings } from "@/settings/LibrarySettings";
import { OpenSourceSettings } from "@/settings/OpenSourceSettings";
import { OverlaySettings } from "@/settings/OverlaySettings";
import { SUPPORT_ACCOUNTS } from "@/systems/constants";
import { state$ } from "@/systems/State";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ax } from "@/utils/ax";

export type SettingsPage = "general" | "library" | "overlay" | "ui-customize" | "account" | "open-source";

type SettingsRoute = { id: SettingsPage; name: string; component: ComponentType };

const SETTINGS_ROUTES: SettingsRoute[] = ax([
    { id: "general", name: "General", component: GeneralSettings },
    { id: "library", name: "Library", component: LibrarySettings },
    { id: "overlay", name: "Overlay", component: OverlaySettings },
    { id: "ui-customize", name: "Customize UI", component: CustomizeUISettings },
    SUPPORT_ACCOUNTS && { id: "account", name: "Account", component: AccountSettings },
    { id: "open-source", name: "Open Source", component: OpenSourceSettings },
]);

const SETTINGS_SCENES = SETTINGS_ROUTES.reduce(
    (acc, route) => {
        acc[route.id] = route.component;
        return acc;
    },
    {} as Record<string, ComponentType>,
);

export default function SettingsContainer() {
    const showSettingsPage = useValue(state$.showSettingsPage);
    const selectedItem$ = useObservable<SettingsPage>(showSettingsPage || "general");

    return (
        <VibrancyView blendingMode="behindWindow" material="sidebar" style={styles.vibrancy}>
            <ThemeProvider>
                <PortalProvider>
                    <TooltipProvider>
                        <Sidebar items={SETTINGS_ROUTES} scenes={SETTINGS_SCENES} selectedItem$={selectedItem$} />
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
