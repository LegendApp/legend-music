import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { localAudioControls, localPlayerState$, queue$ } from "@/components/LocalAudioPlayer";
import { type TrackData, TrackItem } from "@/components/TrackItem";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import { perfCount, perfLog } from "@/utils/perfLogger";

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

        // Filter for audio files
        const audioFiles = files.filter((file) => file.toLowerCase().endsWith(".mp3"));

        if (audioFiles.length === 0) {
            console.log("No audio files to add to queue");
            return;
        }

        try {
            // Create tracks from dropped files
            const tracksToAdd: LocalTrack[] = [];

            for (const filePath of audioFiles) {
                // Extract filename from path
                const fileName = filePath.split("/").pop() || filePath;

                // Create a basic track object - metadata will be loaded later
                const track: LocalTrack = {
                    id: filePath,
                    title: fileName.replace(/\.mp3$/i, ""),
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

    const handleDragOver = useCallback((event: any) => {
        // Prevent default to allow drop
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
        (event: any) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragOver(false);

            // Get dropped files
            const files = event.dataTransfer?.files;
            if (!files) {
                return;
            }

            // Convert FileList to array of file paths
            const filePaths: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.path) {
                    filePaths.push(file.path);
                }
            }

            if (filePaths.length > 0) {
                handleFileDrop(filePaths);
            }
        },
        [handleFileDrop],
    );

    const msg =
        playlist.length === 0
            ? localMusicState.isScanning
                ? `Scanning... ${localMusicState.scanProgress}/${localMusicState.scanTotal}`
                : localMusicState.error
                  ? "Error scanning local files"
                  : "Queue is empty"
            : null;

    return (
        <View
            className={`flex-1 ${isDragOver ? "bg-blue-500/20 border-2 border-blue-500 border-dashed" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
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
                        estimatedItemSize={playlistStyle === "compact" ? 30 : 50}
                        recycleItems
                        renderItem={({ item: track, index }) => (
                            <TrackItem track={track} index={index} onTrackClick={handleTrackClick} />
                        )}
                    />
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 2,
    },
});
