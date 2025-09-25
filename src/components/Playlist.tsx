import { LegendList } from "@legendapp/list";
import { observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { localAudioControls, localPlayerState$, queue$ } from "@/components/LocalAudioPlayer";
import { type TrackData, TrackItem } from "@/components/TrackItem";
import { DragDropView } from "@/native-modules/DragDropView";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import { state$ } from "@/systems/State";
import { perfCount, perfLog } from "@/utils/perfLogger";

// Global state to track whether playlist is actively being navigated
export const playlistNavigationState$ = observable({
    hasSelection: false,
    isSearchDropdownOpen: false,
});

type PlaylistTrackWithSuggestions = TrackData & {
    queueEntryId: string;
    fromSuggestions?: true;
    isSeparator?: boolean;
};

export function Playlist() {
    perfCount("Playlist.render");
    const localMusicState = use$(localMusicState$);
    const queueTracks = use$(queue$.tracks);
    const currentTrackIndex = use$(localPlayerState$.currentIndex);
    const isPlayerActive = use$(localPlayerState$.isPlaying);
    const playlistStyle = use$(settings$.general.playlistStyle);
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    // Render the active playback queue
    const playlist: PlaylistTrackWithSuggestions[] = useMemo(
        () =>
            queueTracks.map((track, index) => ({
                id: track.id,
                title: track.title,
                artist: track.artist,
                duration: track.duration,
                thumbnail: track.thumbnail || "",
                index,
                isPlaying: index === currentTrackIndex && isPlayerActive,
                queueEntryId: track.queueEntryId,
            })),
        [queueTracks, currentTrackIndex, isPlayerActive],
    );

    useEffect(() => {
        perfLog("Playlist.useMemo", {
            length: playlist.length,
            currentTrackIndex,
            isPlayerActive,
        });
    }, [playlist.length, currentTrackIndex, isPlayerActive, playlist]);

    const handleTrackClick = (index: number) => {
        const track = playlist[index];

        // Don't allow clicking on separator items
        if (track?.isSeparator) {
            return;
        }

        if (__DEV__) {
            console.log("Queue -> play index", index);
        }
        localAudioControls.playTrackAtIndex(index);
    };

    const handleFileDrop = useCallback(async (files: string[]) => {
        perfLog("Playlist.handleFileDrop", { fileCount: files.length });

        if (files.length === 0) {
            console.log("No files to add to queue");
            return;
        }

        try {
            // Create tracks from dropped files
            const tracksToAdd: LocalTrack[] = [];

            for (const filePath of files) {
                // Extract filename from path
                const fileName = filePath.split("/").pop() || filePath;
                const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";

                // Create a basic track object - metadata will be loaded later
                const track: LocalTrack = {
                    id: filePath,
                    title: fileName.replace(new RegExp(`\\.${fileExtension}$`, "i"), ""),
                    artist: "Unknown Artist",
                    duration: "0:00",
                    filePath,
                    fileName,
                };

                tracksToAdd.push(track);
            }

            // Add tracks to queue
            localAudioControls.queue.append(tracksToAdd);
            console.log(`Added ${tracksToAdd.length} files to queue`);
        } catch (error) {
            console.error("Error adding dropped files to queue:", error);
        }
    }, []);

    const handleDragEnter = useCallback(() => {
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
        (event: { nativeEvent: { files: string[] } }) => {
            setIsDragOver(false);
            const files = event.nativeEvent.files;
            if (files.length > 0) {
                handleFileDrop(files);
            }
        },
        [handleFileDrop],
    );

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: { keyCode: number; modifiers: number }) => {
            // Only handle keyboard events when there are tracks in the queue and no dropdowns are open
            if (
                playlist.length === 0 ||
                playlistNavigationState$.isSearchDropdownOpen.get() ||
                state$.isDropdownOpen.get()
            ) {
                return false;
            }

            switch (event.keyCode) {
                case KeyCodes.KEY_UP:
                    setSelectedIndex((prev) => {
                        const newIndex = prev <= 0 ? playlist.length - 1 : prev - 1;
                        return newIndex;
                    });
                    return true;

                case KeyCodes.KEY_DOWN:
                    setSelectedIndex((prev) => {
                        const newIndex = prev >= playlist.length - 1 ? 0 : prev + 1;
                        return newIndex;
                    });
                    return true;

                case KeyCodes.KEY_RETURN:
                case KeyCodes.KEY_SPACE:
                    if (selectedIndex >= 0 && selectedIndex < playlist.length) {
                        handleTrackClick(selectedIndex);
                    }
                    return true;

                default:
                    return false;
            }
        };

        const removeListener = KeyboardManager.addKeyDownListener(handleKeyDown);

        return () => {
            removeListener();
        };
    }, [playlist.length, selectedIndex, handleTrackClick]);

    // Initialize selected index when playlist changes
    // useEffect(() => {
    //     if (playlist.length > 0 && selectedIndex === -1) {
    //         setSelectedIndex(0);
    //     } else if (playlist.length === 0) {
    //         setSelectedIndex(-1);
    //     } else if (selectedIndex >= playlist.length) {
    //         setSelectedIndex(playlist.length - 1);
    //     }
    // }, [playlist.length, selectedIndex]);

    // Update global navigation state
    useEffect(() => {
        playlistNavigationState$.hasSelection.set(playlist.length > 0 && selectedIndex !== -1);
    }, [playlist.length, selectedIndex]);

    const msg =
        playlist.length === 0
            ? localMusicState.isScanning
                ? `Scanning... ${localMusicState.scanProgress}/${localMusicState.scanTotal}`
                : localMusicState.error
                  ? "Error scanning local files"
                  : "Queue is empty"
            : null;

    return (
        <DragDropView
            className={`flex-1 ${isDragOver ? "bg-blue-500/20 border-2 border-blue-500 border-dashed" : ""}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            allowedFileTypes={["mp3", "wav", "m4a", "aac", "flac"]}
        >
            {msg ? (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-white/60 text-sm">{msg}</Text>
                    {isDragOver && (
                        <Text className="text-blue-400 text-sm mt-2">Drop audio files here to add to queue</Text>
                    )}
                </View>
            ) : (
                <>
                    {isDragOver && (
                        <View className="absolute inset-0 z-10 flex-1 items-center justify-center bg-blue-500/20">
                            <View className="bg-blue-500 px-4 py-2 rounded-lg">
                                <Text className="text-white font-medium">Drop files to add to queue</Text>
                            </View>
                        </View>
                    )}
                    <LegendList
                        data={playlist}
                        keyExtractor={(item, index) => `queue-${item.queueEntryId ?? item.id ?? index}`}
                        contentContainerStyle={styles.container}
                        waitForInitialLayout={false}
                        estimatedItemSize={playlistStyle === "compact" ? 32 : 50}
                        recycleItems
                        renderItem={({ item: track, index }) => (
                            <TrackItem
                                track={track}
                                index={index}
                                onDoubleClick={handleTrackClick}
                                isSelected={index === selectedIndex}
                            />
                        )}
                    />
                </>
            )}
        </DragDropView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 2,
    },
});
