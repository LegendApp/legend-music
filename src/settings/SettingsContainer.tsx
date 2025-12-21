import { PortalProvider } from "@gorhom/portal";
import type { Observable } from "@legendapp/state";
import { useObservable, useValue } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import { Platform, View } from "react-native";
import { EffectView } from "@/components/EffectView";
import { NativeSidebar } from "@/components/NativeSidebar";
import { Sidebar } from "@/components/Sidebar";
import { TooltipProvider } from "@/components/TooltipProvider";
import { SidebarSplitView } from "@/native-modules/SidebarSplitView";
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

// Define the categories for settings
const SETTING_PAGES: { id: SettingsPage; name: string }[] = ax([
    { id: "general", name: "General" },
    { id: "library", name: "Library" },
    { id: "overlay", name: "Overlay" },
    { id: "ui-customize", name: "Customize UI" },
    SUPPORT_ACCOUNTS && { id: "account", name: "Account" },
    { id: "open-source", name: "Open Source" },
]);

function Content({ selectedItem$ }: { selectedItem$: Observable<SettingsPage> }) {
    const selectedItem = useValue(selectedItem$);

    switch (selectedItem) {
        case "general":
            return <GeneralSettings />;
        case "library":
            return <LibrarySettings />;
        case "overlay":
            return <OverlaySettings />;
        case "ui-customize":
            return <CustomizeUISettings />;
        case "open-source":
            return <OpenSourceSettings />;
        case "account":
            return <AccountSettings />;
        default:
            return null;
    }
}

export default function SettingsContainer() {
    const showSettingsPage = useValue(state$.showSettingsPage);
    const selectedItem$ = useObservable<SettingsPage>(showSettingsPage || "general");
    const selectedItem = useValue(selectedItem$);
    const isMacOS = Platform.OS === "macos";

    const nativeItems = useMemo(() => {
        return SETTING_PAGES.map((item) => ({ id: item.id, label: item.name }));
    }, []);

    const handleSelectionChange = useCallback(
        (id: string) => {
            selectedItem$.set(id as SettingsPage);
        },
        [selectedItem$],
    );

    return (
        <EffectView style={{ flex: 1 }}>
            <ThemeProvider>
                <PortalProvider>
                    <TooltipProvider>
                        {isMacOS ? (
                            <SidebarSplitView className="flex-1">
                                <NativeSidebar
                                    items={nativeItems}
                                    selectedId={selectedItem}
                                    onSelectionChange={handleSelectionChange}
                                />
                                <View className="flex-1 bg-background-primary">
                                    <Content selectedItem$={selectedItem$} />
                                </View>
                            </SidebarSplitView>
                        ) : (
                            <View className="flex flex-1 flex-row">
                                <Sidebar items={SETTING_PAGES} selectedItem$={selectedItem$} width={140} className="py-2" />
                                <View className="flex-1 bg-background-primary">
                                    <Content selectedItem$={selectedItem$} />
                                </View>
                            </View>
                        )}
                    </TooltipProvider>
                </PortalProvider>
            </ThemeProvider>
        </EffectView>
    );
}
