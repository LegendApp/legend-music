import { observer, use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { Select } from "@/components/Select";
import { settings$ } from "@/systems/Settings";

export const GeneralSettings = observer(function GeneralSettings() {
    const playlistStyleOptions = [
        { id: "compact", label: "Compact" },
        { id: "comfortable", label: "Comfortable" },
    ] as const;

    return (
        <View className="flex-1 bg-background-primary">
            <View className="p-6">
                <Text className="text-2xl font-bold text-text-primary mb-6">General Settings</Text>

                {/* Appearance Section */}
                <View className="mb-8">
                    <Text className="text-lg font-semibold text-text-primary mb-4">Appearance</Text>
                    
                    <View className="bg-background-secondary rounded-lg border border-border-primary p-4">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1">
                                <Text className="text-text-primary text-base font-medium">Playlist Style</Text>
                                <Text className="text-text-tertiary text-sm mt-1">
                                    Choose how playlist items are displayed
                                </Text>
                            </View>
                            <View className="w-40 ml-6">
                                <Select
                                    selected$={settings$.general.playlistStyle}
                                    items={playlistStyleOptions}
                                    getItemKey={(item) => item.id}
                                    renderItem={(item, mode) => (
                                        <Text className="text-text-primary text-sm">{item.label}</Text>
                                    )}
                                    placeholder="Select style..."
                                    className="bg-background-tertiary hover:bg-background-secondary rounded-md border border-border-primary"
                                    triggerClassName="px-3 py-2 h-8"
                                    textClassName="text-text-primary text-sm"
                                />
                            </View>
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
