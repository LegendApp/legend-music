import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { type ElementRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findNodeHandle, Platform, StyleSheet, Text, UIManager, View } from "react-native";
import { localAudioControls, localPlayerState$, queue$ } from "@/components/LocalAudioPlayer";
import { type TrackData, TrackItem } from "@/components/TrackItem";
import { usePlaylistSelection } from "@/hooks/usePlaylistSelection";
import {
    DragDropView,
    type NativeDragTrack,
    type TrackDragEnterEvent,
    type TrackDragEvent,
} from "@/native-modules/DragDropView";
import { TrackDragSource } from "@/native-modules/TrackDragSource";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import { perfCount, perfLog } from "@/utils/perfLogger";
import {
    type DragData,
    DraggableItem,
    type DraggedItem,
    DroppableZone,
    MEDIA_LIBRARY_DRAG_ZONE_ID,
    PLAYLIST_DRAG_ZONE_ID,
    type PlaylistDragData,
} from "./dnd";
import { useDragDrop } from "./dnd/DragDropContext";

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
    const queueLength = queueTracks.length;
    const [isDragOver, setIsDragOver] = useState(false);
    const [dropFeedback, setDropFeedback] = useState<DropFeedback | null>(null);
    const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipClickRef = useRef(false);
    const activeNativePlaylistDragRef = useRef<string | null>(null);
    const dropAreaRef = useRef<ElementRef<typeof DragDropView>>(null);
    const dropAreaWindowRectRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
    const lastDropIndexRef = useRef<number>(queueLength);
    const { draggedItem$, activeDropZone$, checkDropZones } = useDragDrop();

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

    const {
        selectedIndices$,
        handleTrackClick: handleTrackClickBase,
        syncSelectionAfterReorder,
    } = usePlaylistSelection({
        items: playlist,
        onDeleteSelection: handleDeleteSelection,
    });

    const nativeDragTracksByEntryId = useMemo(() => {
        const map = new Map<string, NativeDragTrack>();

        for (const track of queueTracks) {
            map.set(track.queueEntryId, {
                id: track.id,
                title: track.title,
                artist: track.artist,
                album: track.album,
                duration: track.duration,
                filePath: track.filePath,
                fileName: track.fileName,
                thumbnail: track.thumbnail,
                queueEntryId: track.queueEntryId,
            });
        }

        return map;
    }, [queueTracks]);

    const handleTrackClick = useCallback(
        (index: number, event?: Parameters<typeof handleTrackClickBase>[1]) => {
            if (skipClickRef.current) {
                skipClickRef.current = false;
                return;
            }
            handleTrackClickBase(index, event);
        },
        [handleTrackClickBase],
    );

    const handleReorderDragStart = useCallback(() => {
        skipClickRef.current = true;
    }, []);

    const handleNativeDragStart = useCallback(
        (queueEntryId?: string) => {
            skipClickRef.current = true;
            if (!queueEntryId) {
                return;
            }

            const dragItem: DraggedItem<DragData> = {
                id: queueEntryId,
                sourceZoneId: PLAYLIST_DRAG_ZONE_ID,
                data: {
                    type: "playlist-track",
                    queueEntryId,
                },
            };

            draggedItem$.set(dragItem);
            activeDropZone$.set(null);
            lastDropIndexRef.current = queueLength;
            updateDropAreaWindowRect();
            requestAnimationFrame(updateDropAreaWindowRect);
            activeNativePlaylistDragRef.current = queueEntryId;
        },
        [activeDropZone$, draggedItem$, queueLength, updateDropAreaWindowRect],
    );

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

    const updateDropAreaWindowRect = useCallback(() => {
        const node = dropAreaRef.current;
        if (!node) {
            return;
        }

        const updateRect = (x: number, y: number, width: number, height: number) => {
            dropAreaWindowRectRef.current = { x, y, width, height };
        };

        if ("measureInWindow" in node && typeof node.measureInWindow === "function") {
            node.measureInWindow((x, y, width, height) => {
                updateRect(x, y, width, height);
            });
            return;
        }

        const handle = findNodeHandle(node);
        if (handle != null) {
            UIManager.measure(handle, (_x, _y, width, height, pageX, pageY) => {
                updateRect(pageX, pageY, width, height);
            });
        }
    }, []);

    const toWindowCoordinates = useCallback((location: { x: number; y: number }) => {
        const rect = dropAreaWindowRectRef.current;
        const clampedX = Math.max(0, Math.min(location.x, rect.width));
        const clampedY = Math.max(0, Math.min(location.y, rect.height));
        return {
            x: rect.x + clampedX,
            y: rect.y + clampedY,
        };
    }, []);

    useEffect(() => {
        updateDropAreaWindowRect();
    }, [updateDropAreaWindowRect, playlist.length]);

    useEffect(() => {
        lastDropIndexRef.current = Math.min(lastDropIndexRef.current, queueLength);
    }, [queueLength]);

    const allowPlaylistDrop = useCallback((item: DraggedItem<DragData>) => {
        if (item.data?.type === "playlist-track") {
            return true;
        }

        if (item.data?.type === "media-library-tracks" && item.sourceZoneId === MEDIA_LIBRARY_DRAG_ZONE_ID) {
            return item.data.tracks.length > 0;
        }

        return false;
    }, []);

    const handleDropAtPosition = useCallback(
        (item: DraggedItem<DragData>, targetPosition: number) => {
            if (item.data?.type === "playlist-track") {
                const sourceIndex = playlist.findIndex((track) => track.queueEntryId === item.data.queueEntryId);
                if (sourceIndex === -1) {
                    return;
                }

                const boundedTarget = Math.max(0, Math.min(targetPosition, playlist.length));

                if (
                    sourceIndex === boundedTarget ||
                    (sourceIndex < boundedTarget && sourceIndex + 1 === boundedTarget)
                ) {
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
                        message: "No tracks to add to the queue.",
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
                    message: "No tracks to add to the queue.",
                });
                return;
            }

            const boundedPosition = Math.max(0, Math.min(dropIndex ?? queueLength, queueLength));

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

    const handleTrackDragEnter = useCallback(
        (event: { nativeEvent: TrackDragEnterEvent }) => {
            activeDropZone$.set(null);
            const nativeTracks = event.nativeEvent.tracks ?? [];
            const playlistQueueEntryId =
                nativeTracks.find((track) => track.queueEntryId)?.queueEntryId ?? activeNativePlaylistDragRef.current;
            if (playlistQueueEntryId) {
                draggedItem$.set({
                    id: playlistQueueEntryId,
                    sourceZoneId: PLAYLIST_DRAG_ZONE_ID,
                    data: {
                        type: "playlist-track",
                        queueEntryId: playlistQueueEntryId,
                    },
                });
                updateDropAreaWindowRect();
                requestAnimationFrame(updateDropAreaWindowRect);
                lastDropIndexRef.current = queueLength;
                activeNativePlaylistDragRef.current = playlistQueueEntryId;
                return;
            }

            const tracks = convertNativeTracksToLocal(nativeTracks);
            if (tracks.length === 0) {
                draggedItem$.set(null);
                activeNativePlaylistDragRef.current = null;
                return;
            }

            draggedItem$.set({
                id: "media-library-native",
                sourceZoneId: MEDIA_LIBRARY_DRAG_ZONE_ID,
                data: {
                    type: "media-library-tracks",
                    tracks,
                },
            });
            updateDropAreaWindowRect();
            requestAnimationFrame(updateDropAreaWindowRect);
            lastDropIndexRef.current = queueLength;
        },
        [activeDropZone$, draggedItem$, queueLength, updateDropAreaWindowRect],
    );

    const handleTrackDragLeave = useCallback(() => {
        lastDropIndexRef.current = queueLength;
        draggedItem$.set(null);
        activeDropZone$.set(null);
        activeNativePlaylistDragRef.current = null;
    }, [activeDropZone$, draggedItem$, queueLength]);

    const handleTrackDragHover = useCallback(
        (event: { nativeEvent: TrackDragEvent }) => {
            const { x, y } = toWindowCoordinates(event.nativeEvent.location);
            checkDropZones(x, y);
            const activeDropZoneId = activeDropZone$.get();
            const dropIndexFromZone = parseDropZonePosition(activeDropZoneId);
            if (dropIndexFromZone !== null) {
                lastDropIndexRef.current = dropIndexFromZone;
            }
        },
        [activeDropZone$, checkDropZones, toWindowCoordinates],
    );

    const handleTrackDrop = useCallback(
        (event: { nativeEvent: TrackDragEvent }) => {
            const { tracks = [], location } = event.nativeEvent;
            const playlistQueueEntryId =
                tracks.find((track) => track.queueEntryId)?.queueEntryId ?? activeNativePlaylistDragRef.current;
            const { x, y } = toWindowCoordinates(location);
            checkDropZones(x, y);
            const activeDropZoneId = activeDropZone$.get();
            const zoneIndex = parseDropZonePosition(activeDropZoneId);
            const fallbackIndex = Math.min(lastDropIndexRef.current, queueLength);
            const dropIndex = zoneIndex !== null ? zoneIndex : fallbackIndex;
            draggedItem$.set(null);
            activeDropZone$.set(null);
            lastDropIndexRef.current = queueLength;

            if (playlistQueueEntryId) {
                const dragItem: DraggedItem<DragData> = {
                    id: playlistQueueEntryId,
                    sourceZoneId: PLAYLIST_DRAG_ZONE_ID,
                    data: {
                        type: "playlist-track",
                        queueEntryId: playlistQueueEntryId,
                    },
                };
                handleDropAtPosition(dragItem, dropIndex);
                activeNativePlaylistDragRef.current = null;
                return;
            }

            const converted = convertNativeTracksToLocal(tracks);
            handleNativeTracksDrop(converted, dropIndex);
            activeNativePlaylistDragRef.current = null;
        },
        [
            activeDropZone$,
            checkDropZones,
            draggedItem$,
            handleDropAtPosition,
            handleNativeTracksDrop,
            queueLength,
            toWindowCoordinates,
        ],
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
        handleTrackClickBase(index);
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

    const overlayClassName = isDragOver ? "bg-blue-500/20 border-2 border-blue-500 border-dashed" : "";

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
            ref={dropAreaRef}
            className={cn("flex-1", overlayClassName)}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onTrackDragEnter={handleTrackDragEnter}
            onTrackDragLeave={handleTrackDragLeave}
            onTrackDragHover={handleTrackDragHover}
            onTrackDrop={handleTrackDrop}
            onLayout={() => {
                requestAnimationFrame(updateDropAreaWindowRect);
            }}
            allowedFileTypes={["mp3", "wav", "m4a", "aac", "flac"]}
        >
            {dropFeedback ? (
                <View className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 items-center">
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
                    {isDragOver && (
                        <View className="absolute inset-0 z-10 flex-1 items-center justify-center">
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
                            <PlaylistDropZone
                                position={0}
                                allowDrop={allowPlaylistDrop}
                                onDrop={handleDropAtPosition}
                            />
                        }
                        recycleItems
                        renderItem={({ item: track, index }) => {
                            const trackContent = (
                                <TrackItem
                                    track={track}
                                    index={index}
                                    onClick={handleTrackClick}
                                    onDoubleClick={handleTrackDoubleClick}
                                    selectedIndices$={selectedIndices$}
                                />
                            );

                            if (Platform.OS === "macos") {
                                return (
                                    <View>
                                        <TrackDragSource
                                            tracks={[convertTrackToNativeDrag(track)]}
                                            onDragStart={() => handleNativeDragStart(track.queueEntryId)}
                                            className="w-full"
                                        >
                                            {trackContent}
                                        </TrackDragSource>
                                        <PlaylistDropZone
                                            position={index + 1}
                                            allowDrop={allowPlaylistDrop}
                                            onDrop={handleDropAtPosition}
                                        />
                                    </View>
                                );
                            }

                            return (
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
                                        onDragStart={handleReorderDragStart}
                                        className="w-full"
                                    >
                                        {trackContent}
                                    </DraggableItem>
                                    <PlaylistDropZone
                                        position={index + 1}
                                        allowDrop={allowPlaylistDrop}
                                        onDrop={handleDropAtPosition}
                                    />
                                </View>
                            );
                        }}
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

function parseDropZonePosition(id: string | null): number | null {
    if (!id || !id.startsWith("playlist-drop-")) {
        return null;
    }

    const value = Number.parseInt(id.replace("playlist-drop-", ""), 10);
    return Number.isFinite(value) ? value : null;
}

function formatTrackCount(count: number): string {
    return `${count} track${count === 1 ? "" : "s"}`;
}

function convertNativeTracksToLocal(tracks: NativeDragTrack[] = []): LocalTrack[] {
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

function convertTrackToNativeDrag(track: TrackData): NativeDragTrack {
    return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        filePath: undefined,
        fileName: undefined,
        thumbnail: track.thumbnail,
        queueEntryId: track.queueEntryId,
    };
}

interface TrackIdentity {
    id?: string;
    filePath?: string;
    queueEntryId?: string;
}

export function filterTracksForInsert(
    _existingQueue: TrackIdentity[],
    incomingTracks: LocalTrack[],
): { filtered: LocalTrack[]; skipped: number } {
    // Duplicates are allowed in the queue, so return a copy of the incoming tracks.
    return { filtered: incomingTracks.slice(), skipped: 0 };
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
