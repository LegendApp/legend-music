import { observer, use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { Checkbox } from "@/components/Checkbox";
import { settings$ } from "@/systems/Settings";

export const YouTubeMusicSettings = observer(function YouTubeMusicSettings() {
    const ytmSettings = use$(settings$.youtubeMusic);

    return (
        <View className="flex-1 bg-background-primary">
            <View className="p-6">
                <Text className="text-2xl font-bold text-text-primary mb-6">YouTube Music Settings</Text>

                {/* Integration Section */}
                <View className="mb-8">
                    <Text className="text-lg font-semibold text-text-primary mb-4">Integration</Text>
                    
                    <View className="bg-background-secondary rounded-lg border border-border-primary p-4">
                        <View className="flex-row items-start">
                            <View className="flex-shrink-0 mt-1">
                                <Checkbox
                                    $checked={settings$.youtubeMusic.enabled}
                                    labelClassName="text-text-primary text-base ml-3 font-medium"
                                />
                            </View>
                            <View className="flex-1 ml-3">
                                <Text className="text-text-primary text-base font-medium">
                                    Enable YouTube Music
                                </Text>
                                <Text className="text-text-tertiary text-sm mt-1">
                                    Enable YouTube Music integration for streaming and playlist management. 
                                    This allows you to access your YouTube Music playlists and stream songs directly.
                                </Text>
                            </View>
                        </View>
                        
                        {ytmSettings.enabled && (
                            <View className="mt-4 pt-4 border-t border-border-primary">
                                <View className="flex-row items-center">
                                    <View className="h-2 w-2 rounded-full bg-emerald-500 mr-2"></View>
                                    <Text className="text-text-secondary text-sm">
                                        YouTube Music integration is active
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {/* Features Section */}
                <View className="mb-8">
                    <Text className="text-lg font-semibold text-text-primary mb-4">Features</Text>
                    
                    <View className="bg-background-secondary rounded-lg border border-border-primary p-4">
                        <View className="space-y-3">
                            <View className="flex-row items-center">
                                <View className="h-1.5 w-1.5 rounded-full bg-accent-primary mr-3"></View>
                                <Text className="text-text-secondary text-sm">Access your YouTube Music playlists</Text>
                            </View>
                            <View className="flex-row items-center">
                                <View className="h-1.5 w-1.5 rounded-full bg-accent-primary mr-3"></View>
                                <Text className="text-text-secondary text-sm">Stream songs directly from YouTube Music</Text>
                            </View>
                            <View className="flex-row items-center">
                                <View className="h-1.5 w-1.5 rounded-full bg-accent-primary mr-3"></View>
                                <Text className="text-text-secondary text-sm">Sync with your YouTube Music library</Text>
                            </View>
                            <View className="flex-row items-center">
                                <View className="h-1.5 w-1.5 rounded-full bg-accent-primary mr-3"></View>
                                <Text className="text-text-secondary text-sm">Control playback and queue management</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Advanced Settings Placeholder */}
                <View className="mb-8">
                    <Text className="text-lg font-semibold text-text-primary mb-4">Advanced</Text>
                    
                    <View className="bg-background-secondary rounded-lg border border-border-primary p-4">
                        <View className="opacity-50">
                            <Text className="text-text-tertiary text-sm text-center py-4">
                                Advanced YouTube Music settings will be added in future updates
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
});