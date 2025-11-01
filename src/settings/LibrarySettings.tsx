import { observer, use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { selectDirectory } from "@/native-modules/FileDialog";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";
import { localMusicSettings$, scanLocalMusic } from "@/systems/LocalMusicState";

export const LibrarySettings = observer(function LibrarySettings() {
    const localMusicSettings = use$(localMusicSettings$);

    const handleRescanLibrary = () => {
        scanLocalMusic();
    };

    const handleRemoveLibraryPath = (index: number) => {
        localMusicSettings$.libraryPaths.set((paths) => {
            if (index < 0 || index >= paths.length) {
                return paths;
            }

            const next = [...paths];
            next.splice(index, 1);
            return next;
        });
    };

    const handleChangeLibraryPath = async (index: number) => {
        const currentPath = localMusicSettings.libraryPaths[index];
        const directory = await selectDirectory({ directoryURL: currentPath });

        if (!directory) {
            return;
        }

        localMusicSettings$.libraryPaths.set((paths) => {
            if (index < 0 || index >= paths.length) {
                return paths;
            }

            if (paths[index] === directory) {
                return paths;
            }

            const next = [...paths];
            next[index] = directory;
            return next;
        });
    };

    const handleAddLibraryPath = async () => {
        const directory = await selectDirectory();

        if (!directory) {
            return;
        }

        localMusicSettings$.libraryPaths.set((paths) => {
            if (paths.includes(directory)) {
                return paths;
            }

            return [...paths, directory];
        });
    };

    return (
        <SettingsPage title="Library Settings">
            <SettingsSection title="Scanning">
                <SettingsRow
                    title="Auto-scan on startup"
                    description="Automatically scan for new music files when the app starts"
                    control={<Checkbox $checked={localMusicSettings$.autoScanOnStart} />}
                    controlWrapperClassName="ml-6"
                />
                <Button variant="primary" size="medium" className="self-start" onClick={handleRescanLibrary}>
                    <Text className="text-white font-medium text-sm">Rescan Library Now</Text>
                </Button>
            </SettingsSection>

            <SettingsSection title="Library Paths">
                {localMusicSettings.libraryPaths.length > 0 ? (
                    <View className="flex flex-col gap-2">
                        {localMusicSettings.libraryPaths.map((path, index) => (
                            <View
                                key={index}
                                className="bg-background-tertiary rounded-md border border-border-primary px-3 py-2 flex-row items-center gap-3"
                            >
                                <Text className="text-text-secondary text-sm font-mono break-all flex-1">{path}</Text>

                                <View className="flex-row items-center gap-2">
                                    <Button
                                        icon="folder"
                                        variant="icon"
                                        size="medium"
                                        tooltip="Choose folder"
                                        onClick={() => {
                                            void handleChangeLibraryPath(index);
                                        }}
                                    />
                                    <Button
                                        icon="trash"
                                        variant="icon"
                                        size="medium"
                                        tooltip="Remove path"
                                        onClick={() => handleRemoveLibraryPath(index)}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View className="bg-background-tertiary rounded-md p-4 border border-border-primary border-dashed">
                        <Text className="text-text-tertiary text-sm text-center">No library paths configured</Text>
                    </View>
                )}

                <Text className="text-text-tertiary text-xs mt-3">
                    Currently configured library paths for local music scanning
                </Text>
                <Button
                    variant="primary"
                    icon="plus"
                    size="medium"
                    className="self-start"
                    onClick={() => {
                        void handleAddLibraryPath();
                    }}
                >
                    <Text className="text-text-primary font-medium text-sm">Add Library Folder</Text>
                </Button>
            </SettingsSection>

            {localMusicSettings.lastScanTime > 0 ? (
                <SettingsSection title="Scan Status">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="text-text-primary text-base font-medium">Last Scan</Text>
                            <Text className="text-text-secondary text-sm mt-1">
                                {new Date(localMusicSettings.lastScanTime).toLocaleString()}
                            </Text>
                        </View>
                        <View className="h-3 w-3 rounded-full bg-emerald-500" />
                    </View>
                </SettingsSection>
            ) : null}
        </SettingsPage>
    );
});
