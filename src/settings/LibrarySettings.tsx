import { observer, use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { localMusicSettings$, scanLocalMusic } from "@/systems/LocalMusicState";

export const LibrarySettings = observer(function LibrarySettings() {
    const localMusicSettings = use$(localMusicSettings$);

    const handleRescanLibrary = () => {
        scanLocalMusic();
    };

    return (
        <View className="flex-1 bg-background-primary">
            <View className="p-6">
                <Text className="text-2xl font-bold text-text-primary mb-6">Library Settings</Text>

                {/* Scanning Section */}
                <View className="mb-8">
                    <Text className="text-lg font-semibold text-text-primary mb-4">Scanning</Text>

                    <View className="bg-background-secondary rounded-lg border border-border-primary p-4">
                        <View className="mb-4">
                            <Checkbox $checked={localMusicSettings$.autoScanOnStart} label="Auto-scan on startup" />
                            <Text className="text-text-tertiary text-sm mt-2 ml-7">
                                Automatically scan for new music files when the app starts
                            </Text>
                        </View>

                        <View className="pt-4 border-t border-border-primary">
                            <Button variant="primary" onPress={handleRescanLibrary} className="h-9 px-4">
                                <Text className="text-white font-medium text-sm">Rescan Library Now</Text>
                            </Button>
                        </View>
                    </View>
                </View>

                {/* Library Paths Section */}
                <View className="mb-8">
                    <Text className="text-lg font-semibold text-text-primary mb-4">Library Paths</Text>

                    <View className="bg-background-secondary rounded-lg border border-border-primary p-4">
                        {localMusicSettings.libraryPaths.length > 0 ? (
                            <View className="space-y-2">
                                {localMusicSettings.libraryPaths.map((path, index) => (
                                    <View
                                        key={index}
                                        className="bg-background-tertiary rounded-md p-3 border border-border-primary"
                                    >
                                        <Text className="text-text-secondary text-sm font-mono break-all">{path}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View className="bg-background-tertiary rounded-md p-4 border border-border-primary border-dashed">
                                <Text className="text-text-tertiary text-sm text-center">
                                    No library paths configured
                                </Text>
                            </View>
                        )}

                        <Text className="text-text-tertiary text-xs mt-3">
                            Currently configured library paths for local music scanning
                        </Text>
                    </View>
                </View>

                {/* Scan Status Section */}
                {localMusicSettings.lastScanTime > 0 && (
                    <View className="mb-8">
                        <Text className="text-lg font-semibold text-text-primary mb-4">Scan Status</Text>

                        <View className="bg-background-secondary rounded-lg border border-border-primary p-4">
                            <View className="flex-row items-center justify-between">
                                <View>
                                    <Text className="text-text-primary text-base font-medium">Last Scan</Text>
                                    <Text className="text-text-secondary text-sm mt-1">
                                        {new Date(localMusicSettings.lastScanTime).toLocaleString()}
                                    </Text>
                                </View>
                                <View className="h-3 w-3 rounded-full bg-emerald-500" />
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
});
