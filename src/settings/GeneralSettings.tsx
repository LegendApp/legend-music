import { observer } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { Checkbox } from "@/components/Checkbox";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";
import { settings$ } from "@/systems/Settings";

export const GeneralSettings = observer(function GeneralSettings() {
    const playlistStyleOptions = [
        { value: "compact", label: "Compact" },
        { value: "comfortable", label: "Comfortable" },
    ];

    return (
        <SettingsPage title="General Settings">
            <SettingsSection title="Appearance">
                {/* <SettingsRow
                    title="Playlist Style"
                    description="Choose how playlist items are displayed"
                    control={
                        <Select
                            value$={settings$.general.playlistStyle}
                            options={playlistStyleOptions}
                            placeholder="Select style..."
                            triggerClassName="px-3"
                        />
                    }
                    controlWrapperClassName="w-40 ml-6"
                /> */}

                <SettingsRow
                    title="Display Hints"
                    description="Toggle contextual hints like the media library status bar"
                    control={<Checkbox $checked={settings$.general.showHints} />}
                />
            </SettingsSection>

            <SettingsSection title="Playback">
                <View className="opacity-50">
                    <Text className="text-text-tertiary text-sm text-center py-4">
                        Additional playback settings will be added in future updates
                    </Text>
                </View>
            </SettingsSection>
        </SettingsPage>
    );
});
