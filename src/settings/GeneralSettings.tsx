import { observer, use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { Checkbox } from "@/components/Checkbox";
import { Select } from "@/components/Select";
import { settings$ } from "@/systems/Settings";

export const GeneralSettings = observer(function GeneralSettings() {
    const playlistStyleOptions = [
        { value: "compact", label: "Compact" },
        { value: "comfortable", label: "Comfortable" },
    ];

    return (
        <View className="flex-1 bg-background-primary">
            <View className="p-6">
                <Text className="text-2xl font-bold text-text-primary mb-6">General Settings</Text>

                {/* Appearance Section */}
                <View className="mb-8">
                    <Text className="text-lg font-semibold text-text-primary mb-4">Appearance</Text>

                    <View className="bg-background-secondary rounded-lg border border-border-primary p-4 gap-4">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1">
                                <Text className="text-text-primary text-base font-medium">Playlist Style</Text>
                                <Text className="text-text-tertiary text-sm mt-1">
                                    Choose how playlist items are displayed
                                </Text>
                            </View>
                            <View className="w-40 ml-6">
                                <Select
                                    value$={settings$.general.playlistStyle}
                                    options={playlistStyleOptions}
                                    placeholder="Select style..."
                                    triggerClassName="px-3"
                                />
                            </View>
                        </View>

                        <View className="flex-row items-start justify-between">
                            <View className="flex-1 pr-6">
                                <Text className="text-text-primary text-base font-medium">Display Hints</Text>
                                <Text className="text-text-tertiary text-sm mt-1">
                                    Toggle contextual hints like the media library status bar
                                </Text>
                            </View>
                            <Checkbox $checked={settings$.general.showHints} />
                        </View>
                    </View>
                </View>

                {/* Future sections can be added here */}
                <View className="mb-8">
                    <Text className="text-lg font-semibold text-text-primary mb-4">Playback</Text>

                    <View className="bg-background-secondary rounded-lg border border-border-primary p-4">
                        <View className="opacity-50">
                            <Text className="text-text-tertiary text-sm text-center py-4">
                                Additional playback settings will be added in future updates
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
});
