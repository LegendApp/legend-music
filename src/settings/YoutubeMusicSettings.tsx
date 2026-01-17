import { useValue } from "@legendapp/state/react";
import { useCallback } from "react";
import { Text, View } from "react-native";
import Config from "react-native-config";
import { Checkbox } from "@/components/Checkbox";
import { providerSettings$, setActiveProvider } from "@/providers/providerRegistry";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";

export function YoutubeMusicSettings() {
    const providerSettings = useValue(providerSettings$);
    const activeProvider = providerSettings.activeProviderId;
    const isYoutubeMusicEnabled = activeProvider === "youtubeMusic";
    const hasYoutubeMusicClientId = Boolean((Config.YOUTUBE_CLIENT_ID ?? "").trim());
    const handleYoutubeMusicToggle = useCallback((enabled: boolean) => {
        setActiveProvider(enabled ? "youtubeMusic" : "local");
    }, []);

    return (
        <SettingsPage>
            <SettingsSection
                title="YouTube Music"
                description="Enable YouTube Music playback and search using the YouTube Data API."
                first
            >
                <SettingsRow
                    title="Enable YouTube Music"
                    description="Use YouTube Music as the active streaming provider."
                    control={<Checkbox checked={isYoutubeMusicEnabled} onChange={handleYoutubeMusicToggle} />}
                />
                <SettingsRow
                    title="Status"
                    description="Check if YouTube Music search is ready."
                    control={
                        <View className="items-end gap-1">
                            <Text className="text-sm text-text-secondary">
                                {!isYoutubeMusicEnabled
                                    ? "YouTube Music is disabled."
                                    : hasYoutubeMusicClientId
                                      ? "Client ID configured."
                                      : "Missing bundled client ID."}
                            </Text>
                        </View>
                    }
                    controlWrapperClassName="ml-6"
                />
            </SettingsSection>
        </SettingsPage>
    );
}
