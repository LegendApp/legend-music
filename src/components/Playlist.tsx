import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { localAudioControls, localPlayerState$, queue$ } from "@/components/LocalAudioPlayer";
import { type TrackData, TrackItem } from "@/components/TrackItem";
import { usePlaylistSelection } from "@/hooks/usePlaylistSelection";
import { DragDropView } from "@/native-modules/DragDropView";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import { perfCount, perfLog } from "@/utils/perfLogger";
import { DraggableItem, type DraggedItem, DroppableZone } from "./dnd";

type PlaylistTrackWithSuggestions = TrackData & {
    queueEntryId: string;
    fromSuggestions?: true;
    isSeparator?: boolean;
};

type PlaylistDragData = {
    type: "playlist-track";
    queueEntryId: string;
};

const PLAYLIST_DRAG_ZONE_ID = "playlist-tracks";

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

    const handleDeleteSelection = useCallback((indices: number[]) => {
        if (indices.length === 0) {
            return;
        }

        perfLog("Playlist.handleDeleteSelection", { count: indices.length });
        localAudioControls.queue.remove(indices);
    }, []);

    const { selectedIndices$, handleTrackClick, syncSelectionAfterReorder } = usePlaylistSelection({
        items: playlist,
        onDeleteSelection: handleDeleteSelection,
    });

    const allowPlaylistDrop = useCallback((item: DraggedItem<PlaylistDragData>) => {
        return item.sourceZoneId === PLAYLIST_DRAG_ZONE_ID && item.data?.type === "playlist-track";
    }, []);

    const handleReorderDrop = useCallback(
        (item: DraggedItem<PlaylistDragData>, targetPosition: number) => {
            if (item.data?.type !== "playlist-track") {
                return;
            }

            const sourceIndex = playlist.findIndex((track) => track.queueEntryId === item.data.queueEntryId);
            if (sourceIndex === -1) {
                return;
            }

            const boundedTarget = Math.max(0, Math.min(targetPosition, playlist.length));

            if (sourceIndex === boundedTarget || (sourceIndex < boundedTarget && sourceIndex + 1 === boundedTarget)) {
                return;
            }

            localAudioControls.queue.reorder(sourceIndex, boundedTarget);
            syncSelectionAfterReorder(sourceIndex, boundedTarget);
        },
        [playlist, syncSelectionAfterReorder],
    );

    const handleTrackDoubleClick = (index: number) => {
        const track = playlist[index];

        // Don't allow clicking on separator items
        if (track?.isSeparator) {
            return;
        }

        if (__DEV__) {
            console.log("Queue -> play index", index);
        }
        handleTrackClick(index);
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
    // useEffect(() => {
    //     playlistNavigationState$.hasSelection.set(playlist.length > 0 && selectedIndex !== -1);
    // }, [playlist.length, selectedIndex]);

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
                        ListHeaderComponent={
                            <PlaylistDropZone position={0} allowDrop={allowPlaylistDrop} onDrop={handleReorderDrop} />
                        }
                        recycleItems
                        renderItem={({ item: track, index }) => (
                            <View>
                                <DraggableItem
                                    id={track.queueEntryId}
                                    zoneId={PLAYLIST_DRAG_ZONE_ID}
                                    data={{ type: "playlist-track", queueEntryId: track.queueEntryId }}
                                >
                                    <TrackItem
                                        track={track}
                                        index={index}
                                        onClick={handleTrackClick}
                                        onDoubleClick={handleTrackDoubleClick}
                                        selectedIndices$={selectedIndices$}
                                    />
                                </DraggableItem>
                                <PlaylistDropZone
                                    position={index + 1}
                                    allowDrop={allowPlaylistDrop}
                                    onDrop={handleReorderDrop}
                                />
                            </View>
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

interface PlaylistDropZoneProps {
    position: number;
    allowDrop: (item: DraggedItem<PlaylistDragData>) => boolean;
    onDrop: (item: DraggedItem<PlaylistDragData>, position: number) => void;
}

function PlaylistDropZone({ position, allowDrop, onDrop }: PlaylistDropZoneProps) {
    const dropId = `playlist-drop-${position}`;

    return (
        <DroppableZone
            id={dropId}
            allowDrop={(item) => allowDrop(item as DraggedItem<PlaylistDragData>)}
            onDrop={(item) => onDrop(item as DraggedItem<PlaylistDragData>, position)}
        >
            {(isActive) => (
                <View
                    className={"h-[3px] -mt-[3px] rounded-full bg-blue-500 transition-opacity duration-100"}
                    style={{ opacity: isActive ? 1 : 0 }}
                />
            )}
        </DroppableZone>
    );
}
