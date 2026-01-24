import { PortalProvider } from "@gorhom/portal";
import type { Observable } from "@legendapp/state";
import { useObservable, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo } from "react";
import { Platform, View } from "react-native";
import { NativeSidebar } from "@/components/NativeSidebar";
import { Sidebar } from "@/components/Sidebar";
import { TooltipProvider } from "@/components/TooltipProvider";
import { SidebarSplitView } from "@/native-modules/SidebarSplitView";
import { setWindowTitle } from "@/native-modules/WindowManager";
import { getStreamingProviderPlugin, getStreamingProviderPlugins } from "@/providers/pluginRegistry";
import { ensureStreamingProvidersRegistered } from "@/providers/setupProviders";
import type { StreamingProviderId } from "@/providers/types";
import { AccountSettings } from "@/settings/AccountSettings";
import { AISettings } from "@/settings/AISettings";
import { CustomizeUISettings } from "@/settings/CustomizeUISettings";
import { GeneralSettings } from "@/settings/GeneralSettings";
import { LibrarySettings } from "@/settings/LibrarySettings";
import { OpenSourceSettings } from "@/settings/OpenSourceSettings";
import { OverlaySettings } from "@/settings/OverlaySettings";
import { SUPPORT_ACCOUNTS } from "@/systems/constants";
import { state$ } from "@/systems/State";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ax } from "@/utils/ax";

export type SettingsPage = string;

const PROVIDER_SETTINGS_PREFIX = "provider:";
const buildProviderSettingsId = (providerId: StreamingProviderId): SettingsPage =>
    `${PROVIDER_SETTINGS_PREFIX}${providerId}`;
const parseProviderSettingsId = (value: string): StreamingProviderId | null =>
    value.startsWith(PROVIDER_SETTINGS_PREFIX)
        ? (value.slice(PROVIDER_SETTINGS_PREFIX.length) as StreamingProviderId)
        : null;
const normalizeSettingsKey = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const coerceSettingsPage = (value: string): SettingsPage => {
    if (value.startsWith(PROVIDER_SETTINGS_PREFIX)) {
        return value;
    }

    const normalizedValue = normalizeSettingsKey(value);
    const providerMatch = getStreamingProviderPlugins().find((plugin) => {
        const idKey = normalizeSettingsKey(plugin.provider.id);
        const nameKey = normalizeSettingsKey(plugin.provider.name);
        return normalizedValue === idKey || normalizedValue === nameKey;
    });

    if (providerMatch?.ui?.settings) {
        return buildProviderSettingsId(providerMatch.provider.id);
    }

    return value;
};

// Define the categories for settings
ensureStreamingProvidersRegistered();

const buildSettingPages = (): { id: SettingsPage; name: string }[] => {
    const providerPages = getStreamingProviderPlugins()
        .filter((plugin) => plugin.ui?.settings)
        .map((plugin) => ({
            id: buildProviderSettingsId(plugin.provider.id),
            name: plugin.provider.name,
        }));

    return ax([
        { id: "general", name: "General" },
        { id: "library", name: "Library" },
        { id: "ai", name: "AI" },
        { id: "overlay", name: "Overlay" },
        ...providerPages,
        { id: "ui-customize", name: "Customize UI" },
        SUPPORT_ACCOUNTS && { id: "account", name: "Account" },
        { id: "open-source", name: "Open Source" },
    ]);
};

function Content({ selectedItem$ }: { selectedItem$: Observable<SettingsPage> }) {
    const selectedItem = useValue(selectedItem$);
    const providerId = parseProviderSettingsId(selectedItem);

    if (providerId) {
        const StreamingProviderSettings = getStreamingProviderPlugin(providerId)?.ui?.settings ?? null;
        return StreamingProviderSettings ? <StreamingProviderSettings /> : null;
    }

    switch (selectedItem) {
        case "general":
            return <GeneralSettings />;
        case "library":
            return <LibrarySettings />;
        case "ai":
            return <AISettings />;
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
    const selectedItem$ = useObservable<SettingsPage>(coerceSettingsPage(showSettingsPage || "general"));
    const selectedItem = useValue(selectedItem$);
    const isMacOS = Platform.OS === "macos";
    const settingPages = useMemo(() => buildSettingPages(), []);

    const nativeItems = useMemo(() => {
        return settingPages.map((item) => ({ id: item.id, label: item.name }));
    }, [settingPages]);

    useEffect(() => {
        const pageName = settingPages.find((page) => page.id === selectedItem)?.name ?? "Settings";
        setWindowTitle("settings", pageName);
    }, [selectedItem, settingPages]);

    const handleSelectionChange = useCallback(
        (id: string) => {
            selectedItem$.set(id as SettingsPage);
        },
        [selectedItem$],
    );

    return (
        <View className="flex-1">
            <ThemeProvider>
                <PortalProvider>
                    <TooltipProvider>
                        {isMacOS ? (
                            <SidebarSplitView className="flex-1 bg-background-primary">
                                <NativeSidebar
                                    items={nativeItems}
                                    selectedId={selectedItem}
                                    onSelectionChange={handleSelectionChange}
                                />
                                <View className="flex-1">
                                    <Content selectedItem$={selectedItem$} />
                                </View>
                            </SidebarSplitView>
                        ) : (
                            <View className="flex flex-1 flex-row">
                                <Sidebar
                                    items={settingPages}
                                    selectedItem$={selectedItem$}
                                    width={140}
                                    className="py-2"
                                />
                                <View className="flex-1">
                                    <Content selectedItem$={selectedItem$} />
                                </View>
                            </View>
                        )}
                    </TooltipProvider>
                </PortalProvider>
            </ThemeProvider>
        </View>
    );
}
