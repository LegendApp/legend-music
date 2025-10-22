import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { localAudioControls, localPlayerState$, queue$ } from "@/components/LocalAudioPlayer";
import { type TrackData, TrackItem } from "@/components/TrackItem";
import { usePlaylistSelection } from "@/hooks/usePlaylistSelection";
import { DragDropView, type NativeDragTrack, type TrackDragEvent } from "@/native-modules/DragDropView";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import { perfCount, perfLog } from "@/utils/perfLogger";
import { cn } from "@/utils/cn";
import {
    DraggableItem,
    type DraggedItem,
    DroppableZone,
    MEDIA_LIBRARY_DRAG_ZONE_ID,
    PLAYLIST_DRAG_ZONE_ID,
    type DragData,
    type PlaylistDragData,
} from "./dnd";

type PlaylistTrackWithSuggestions = TrackData & {
    queueEntryId: string;
    fromSuggestions?: true;
    isSeparator?: boolean;
};

interface DropFeedback {
    type: "success" | "warning";
    message: string;
}

export function Playlist() {
    perfCount("Playlist.render");
    const localMusicState = use$(localMusicState$);
    const queueTracks = use$(queue$.tracks);
    const currentTrackIndex = use$(localPlayerState$.currentIndex);
    const isPlayerActive = use$(localPlayerState$.isPlaying);
    const playlistStyle = use$(settings$.general.playlistStyle);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isTrackDragOver, setIsTrackDragOver] = useState(false);
    const [trackDropIndicatorIndex, setTrackDropIndicatorIndex] = useState<number | null>(null);
    const [dropFeedback, setDropFeedback] = useState<DropFeedback | null>(null);
    const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropAreaHeightRef = useRef(0);

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

    const showDropFeedback = useCallback(
        (feedback: DropFeedback) => {
            setDropFeedback(feedback);
            if (feedbackTimeoutRef.current) {
                clearTimeout(feedbackTimeoutRef.current);
            }
            feedbackTimeoutRef.current = setTimeout(() => {
                setDropFeedback(null);
                feedbackTimeoutRef.current = null;
            }, 3000);
        },
        [setDropFeedback],
    );

    useEffect(
        () => () => {
            if (feedbackTimeoutRef.current) {
                clearTimeout(feedbackTimeoutRef.current);
            }
        },
        [],
    );

    const allowPlaylistDrop = useCallback((item: DraggedItem<DragData>) => {
        if (item.data?.type === "playlist-track") {
            return true;
        }

        if (item.data?.type === "media-library-tracks" && item.sourceZoneId === MEDIA_LIBRARY_DRAG_ZONE_ID) {
            return item.data.tracks.length > 0;
        }

        return false;
    }, []);

    const computeDropIndexFromLocation = useCallback(
        (locationY: number) => {
            const height = dropAreaHeightRef.current;
            const length = playlist.length;

            if (height <= 0 || length === 0) {
                return queueTracks.length;
            }

            const clampedY = Math.min(Math.max(locationY, 0), height);
            const distanceFromTop = height - clampedY;
            const ratio = height > 0 ? distanceFromTop / height : 1;
            const index = Math.round(ratio * length);
            return Math.max(0, Math.min(index, queueTracks.length));
        },
        [playlist.length, queueTracks.length],
    );

    const handleDropAtPosition = useCallback(
        (item: DraggedItem<DragData>, targetPosition: number) => {
            if (item.data?.type === "playlist-track") {
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
                return;
            }

            if (item.data?.type === "media-library-tracks") {
                const existingQueue = queueTracks;
                const boundedTarget = Math.max(0, Math.min(targetPosition, existingQueue.length));
                const { filtered, skipped } = filterTracksForInsert(existingQueue, item.data.tracks);

                if (filtered.length === 0) {
                    showDropFeedback({
                        type: "warning",
                        message: "All dropped tracks are already in the queue.",
                    });
                    return;
                }

                localAudioControls.queue.insertAt(boundedTarget, filtered);

                if (skipped > 0) {
                    showDropFeedback({
                        type: "warning",
                        message: `Added ${formatTrackCount(filtered.length)} (skipped ${formatTrackCount(skipped)} already in queue).`,
                    });
                } else {
                    showDropFeedback({
                        type: "success",
                        message: `Added ${formatTrackCount(filtered.length)} to the queue.`,
                    });
                }
            }
        },
        [playlist, queueTracks, showDropFeedback, syncSelectionAfterReorder],
    );

    const handleNativeTracksDrop = useCallback(
        (tracks: LocalTrack[], dropIndex?: number) => {
            const { filtered, skipped } = filterTracksForInsert(queueTracks, tracks);

            if (filtered.length === 0) {
                showDropFeedback({
                    type: "warning",
                    message: "All dropped tracks are already in the queue.",
                });
                return;
            }

            const boundedPosition = Math.max(0, Math.min(dropIndex ?? queueTracks.length, queueTracks.length));

            localAudioControls.queue.insertAt(boundedPosition, filtered);

            if (skipped > 0) {
                showDropFeedback({
                    type: "warning",
                    message: `Added ${formatTrackCount(filtered.length)} (skipped ${formatTrackCount(skipped)} already in queue).`,
                });
            } else {
                showDropFeedback({
                    type: "success",
                    message: `Added ${formatTrackCount(filtered.length)} to the queue.`,
                });
            }
        },
        [queueTracks, showDropFeedback],
    );

    const handleTrackDragEnter = useCallback(() => {
        setIsTrackDragOver(true);
    }, []);

    const handleTrackDragLeave = useCallback(() => {
        setIsTrackDragOver(false);
        setTrackDropIndicatorIndex(null);
    }, []);

    const handleTrackDragHover = useCallback(
        (event: { nativeEvent: TrackDragEvent }) => {
            const dropIndex = computeDropIndexFromLocation(event.nativeEvent.location.y);
            setTrackDropIndicatorIndex(dropIndex);
        },
        [computeDropIndexFromLocation],
    );

    const handleTrackDrop = useCallback(
        (event: { nativeEvent: TrackDragEvent }) => {
            setIsTrackDragOver(false);
            const { tracks, location } = event.nativeEvent;
            const dropIndex = computeDropIndexFromLocation(location.y);
            setTrackDropIndicatorIndex(null);
            const converted = convertNativeTracksToLocal(tracks as NativeDragTrack[]);
            handleNativeTracksDrop(converted, dropIndex);
        },
        [computeDropIndexFromLocation, handleNativeTracksDrop],
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

    const overlayClassName = isDragOver
        ? "bg-blue-500/20 border-2 border-blue-500 border-dashed"
        : isTrackDragOver
          ? "bg-emerald-500/15 border-2 border-emerald-400 border-dashed"
          : "";

    const dropIndicatorTop = trackDropIndicatorIndex !== null && playlist.length > 0 && dropAreaHeightRef.current > 0
        ? (dropAreaHeightRef.current * (trackDropIndicatorIndex / Math.max(playlist.length, 1)))
        : null;

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
            className={cn("flex-1", overlayClassName)}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onTrackDragEnter={handleTrackDragEnter}
            onTrackDragLeave={handleTrackDragLeave}
            onTrackDragHover={handleTrackDragHover}
            onTrackDrop={handleTrackDrop}
            onLayout={(event) => {
                dropAreaHeightRef.current = event.nativeEvent.layout.height;
            }}
            allowedFileTypes={["mp3", "wav", "m4a", "aac", "flac"]}
        >
            {dropFeedback ? (
                <View className="pointer-events-none absolute top-3 right-3 z-20">
                    <View
                        className={cn(
                            "px-3 py-2 rounded-md border shadow-lg backdrop-blur-md",
                            dropFeedback.type === "warning"
                                ? "bg-yellow-500/20 border-yellow-400/70"
                                : "bg-emerald-500/20 border-emerald-400/60",
                        )}
                    >
                        <Text
                            className={cn(
                                "text-xs font-medium",
                                dropFeedback.type === "warning" ? "text-yellow-50" : "text-emerald-50",
                            )}
                        >
                            {dropFeedback.message}
                        </Text>
                    </View>
                </View>
            ) : null}
            {msg ? (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-white/60 text-sm">{msg}</Text>
                    {isDragOver && (
                        <Text className="text-blue-400 text-sm mt-2">Drop audio files here to add to queue</Text>
                    )}
                </View>
            ) : (
                <>
                    {(isDragOver || isTrackDragOver) && (
                        <View className="absolute inset-0 z-10 flex-1 items-center justify-center">
                            <View
                                className={cn(
                                    "px-4 py-2 rounded-lg",
                                    isTrackDragOver ? "bg-emerald-500" : "bg-blue-500",
                                )}
                            >
                                <Text className="text-white font-medium">
                                    {isTrackDragOver ? "Drop tracks to add to queue" : "Drop files to add to queue"}
                                </Text>
                            </View>
                        </View>
                    )}
                    {dropIndicatorTop !== null && isTrackDragOver && (
                        <View
                            className="pointer-events-none absolute left-0 right-0 z-20"
                            style={{ top: dropIndicatorTop - 1 }}
                        >
                            <View className="h-[2px] bg-emerald-400/80" />
                        </View>
                    )}
                    <LegendList
                        data={playlist}
                        keyExtractor={(item, index) => `queue-${item.queueEntryId ?? item.id ?? index}`}
                        contentContainerStyle={styles.container}
                        waitForInitialLayout={false}
                        estimatedItemSize={playlistStyle === "compact" ? 32 : 50}
                        ListHeaderComponent={
                            <PlaylistDropZone position={0} allowDrop={allowPlaylistDrop} onDrop={handleDropAtPosition} />
                        }
                        recycleItems
                        renderItem={({ item: track, index }) => (
                            <View>
                                <DraggableItem
                                    id={track.queueEntryId}
                                    zoneId={PLAYLIST_DRAG_ZONE_ID}
                                    data={
                                        {
                                            type: "playlist-track",
                                            queueEntryId: track.queueEntryId,
                                        } satisfies PlaylistDragData
                                    }
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
                                    onDrop={handleDropAtPosition}
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

function formatTrackCount(count: number): string {
    return `${count} track${count === 1 ? "" : "s"}`;
}

function convertNativeTracksToLocal(tracks: NativeDragTrack[]): LocalTrack[] {
    return tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration ?? "0:00",
        filePath: track.filePath ?? track.id,
        fileName: track.fileName ?? track.title,
        thumbnail: track.thumbnail,
    }));
}

interface TrackIdentity {
    id?: string;
    filePath?: string;
    queueEntryId?: string;
}

export function filterTracksForInsert(
    existingQueue: TrackIdentity[],
    incomingTracks: LocalTrack[],
): { filtered: LocalTrack[]; skipped: number } {
    const seen = new Set<string>();

    for (const track of existingQueue) {
        const key = track.filePath ?? track.id ?? track.queueEntryId;
        if (key) {
            seen.add(key);
        }
    }

    const filtered: LocalTrack[] = [];
    let skipped = 0;

    for (const track of incomingTracks) {
        const key = track.filePath ?? track.id;
        if (key && seen.has(key)) {
            skipped += 1;
            continue;
        }

        if (key) {
            seen.add(key);
        }

        filtered.push(track);
    }

    return { filtered, skipped };
}

interface PlaylistDropZoneProps {
    position: number;
    allowDrop: (item: DraggedItem<DragData>) => boolean;
    onDrop: (item: DraggedItem<DragData>, position: number) => void;
}

function PlaylistDropZone({ position, allowDrop, onDrop }: PlaylistDropZoneProps) {
    const dropId = `playlist-drop-${position}`;

    return (
        <DroppableZone
            id={dropId}
            allowDrop={(item) => allowDrop(item as DraggedItem<DragData>)}
            onDrop={(item) => onDrop(item as DraggedItem<DragData>, position)}
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
