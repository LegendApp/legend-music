import { observer, use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { SkiaSpinner } from "@/components/SkiaSpinner";
import { Button } from "@/components/Button";
import { selectDirectory } from "@/native-modules/FileDialog";
import { SettingsPage, SettingsSection } from "@/settings/components";
import { localMusicSettings$, localMusicState$ } from "@/systems/LocalMusicState";

export const LibrarySettings = observer(function LibrarySettings() {
    const localMusicSettings = use$(localMusicSettings$);
    const localMusicState = use$(localMusicState$);

    const hasTrackEstimate =
        localMusicState.scanTrackTotal > 0 && localMusicState.scanTrackTotal >= localMusicState.scanTrackProgress;
    const trackProgressText =
        hasTrackEstimate && localMusicState.scanTrackProgress > 0
            ? `${localMusicState.scanTrackProgress}/${localMusicState.scanTrackTotal} tracks`
            : localMusicState.scanTrackProgress > 0
              ? `${localMusicState.scanTrackProgress} tracks processed`
              : "Preparing track list…";

    const folderProgressText =
        localMusicState.scanTotal > 0
            ? `${localMusicState.scanProgress}/${localMusicState.scanTotal} folders`
            : null;

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
                                        iconMarginTop={-1}
                                        onClick={() => {
                                            void handleChangeLibraryPath(index);
                                        }}
                                    />
                                    <Button
                                        icon="trash"
                                        variant="icon"
                                        size="medium"
                                        tooltip="Remove path"
                                        iconMarginTop={-1}
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
                    iconMarginTop={-1}
                    className="self-start"
                    onClick={() => {
                        void handleAddLibraryPath();
                    }}
                >
                    <Text className="text-text-primary font-medium text-sm">Add Library Folder</Text>
                </Button>
                {localMusicState.isScanning ? (
                    <View className="flex-row items-center gap-3 mb-3">
                        <SkiaSpinner size={28} color="#7dd6ff" trailColor="rgba(255,255,255,0.08)" />
                        <View className="flex-1 gap-1">
                            <Text className="text-text-primary text-sm font-medium">Scanning your library…</Text>
                            <View className="flex-row items-center gap-2">
                                <Text className="text-text-secondary text-xs font-medium">{trackProgressText}</Text>
                                {folderProgressText ? (
                                    <Text className="text-text-tertiary text-xs">{folderProgressText}</Text>
                                ) : null}
                            </View>
                            <Text className="text-text-tertiary text-xs">
                                This can take a moment for large folders. You can keep using the app while we scan.
                            </Text>
                        </View>
                    </View>
                ) : null}
            </SettingsSection>
        </SettingsPage>
    );
});
