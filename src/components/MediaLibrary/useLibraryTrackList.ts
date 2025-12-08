import type { Observable } from "@legendapp/state";
import { useObserveEffect, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { NativeMouseEvent } from "react-native-macos";

import type { MediaLibraryDragData } from "@/components/dnd";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import type { TrackData } from "@/components/TrackItem";
import { usePlaylistSelection } from "@/hooks/usePlaylistSelection";
import { showContextMenu } from "@/native-modules/ContextMenu";
import { getArtistKey, library$, libraryUI$, type LibraryItem, type LibraryTrack } from "@/systems/LibraryState";
import { getQueueAction, type QueueAction } from "@/utils/queueActions";
import { buildTrackContextMenuItems, handleTrackContextMenuSelection } from "@/utils/trackContextMenu";

type TrackListItem = TrackData;

interface UseLibraryTrackListResult {
    tracks: TrackData[];
    selectedIndices$: Observable<Set<number>>;
    handleTrackClick: (index: number, event?: NativeMouseEvent) => void;
    handleTrackDoubleClick: (index: number, event?: NativeMouseEvent) => void;
    handleTrackContextMenu: (index: number, event: NativeMouseEvent) => Promise<void>;
    handleNativeDragStart: () => void;
    buildDragData: (activeIndex: number) => MediaLibraryDragData;
    keyExtractor: (item: TrackData) => string;
    selectedItem: LibraryItem | null;
}

interface BuildTrackItemsInput {
    tracks: LibraryTrack[];
    selectedItem: LibraryItem | null;
    searchQuery: string;
}

export function buildTrackItems({ tracks, selectedItem, searchQuery }: BuildTrackItemsInput) {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const selectedArtistKey = selectedItem?.type === "artist" ? getArtistKey(selectedItem.name) : null;

    if (!selectedItem && !normalizedQuery) {
        return {
            sourceTracks: [] as LibraryTrack[],
            trackItems: [] as TrackListItem[],
        };
    }

    let filteredTracks: LibraryTrack[];
    if (normalizedQuery) {
        filteredTracks = tracks;
    } else if (selectedItem?.type === "artist") {
        filteredTracks = tracks.filter((track) => {
            const trackArtistKey = getArtistKey(track.artist);
            if (selectedArtistKey) {
                return trackArtistKey === selectedArtistKey;
            }

            return track.artist === selectedItem.name;
        });
    } else if (selectedItem?.type === "album") {
        const albumName = selectedItem.album ?? selectedItem.name;
        filteredTracks = tracks.filter((track) => (track.album ?? "Unknown Album") === albumName);
    } else if (selectedItem?.type === "playlist") {
        filteredTracks = tracks;
    } else {
        filteredTracks = tracks;
    }

    if (normalizedQuery) {
        filteredTracks = filteredTracks.filter((track) => {
            const title = track.title?.toLowerCase() ?? "";
            const artist = track.artist?.toLowerCase() ?? "";
            const album = track.album?.toLowerCase() ?? "";
            return (
                title.includes(normalizedQuery) || artist.includes(normalizedQuery) || album.includes(normalizedQuery)
            );
        });
    }

    return {
        sourceTracks: filteredTracks,
        trackItems: filteredTracks.map((track) => ({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: formatDuration(track.duration),
            thumbnail: track.thumbnail,
        })),
    };
}

export function useLibraryTrackList(searchQuery: string): UseLibraryTrackListResult {
    const selectedItem = useValue(libraryUI$.selectedItem);
    const allTracks = useValue(library$.tracks);
    const skipClickRef = useRef(false);

    const { sourceTracks, trackItems } = useMemo(
        () =>
            buildTrackItems({
                tracks: allTracks,
                selectedItem,
                searchQuery,
            }),
        [allTracks, searchQuery, selectedItem],
    );

    const {
        selectedIndices$,
        handleTrackClick: handleSelectionClick,
        clearSelection,
    } = usePlaylistSelection({
        items: trackItems,
    });

    useObserveEffect(() => {
        const selectedItemId = libraryUI$.selectedItem.get()?.id;
        const trackCount = library$.tracks.get().length;
        if (selectedItemId || trackCount >= 0) {
            clearSelection();
        }
    });

    useEffect(() => {
        clearSelection();
    }, [trackItems.length]);

    const handleTrackAction = useCallback(
        (index: number, action: QueueAction) => {
            const track = sourceTracks[index];
            if (!track) {
                return;
            }

            switch (action) {
                case "play-now":
                    localAudioControls.queue.insertNext(track, { playImmediately: true });
                    break;
                case "play-next":
                    localAudioControls.queue.insertNext(track);
                    break;
                default:
                    localAudioControls.queue.append(track);
                    break;
            }
        },
        [sourceTracks],
    );

    const trackContextMenuItems = useMemo(
        () =>
            buildTrackContextMenuItems({
                includeQueueActions: true,
                includeFinder: true,
            }),
        [],
    );

    const handleTrackContextMenu = useCallback(
        async (index: number, event: NativeMouseEvent) => {
            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;

            const selection = await showContextMenu(trackContextMenuItems, { x, y });

            await handleTrackContextMenuSelection({
                selection,
                filePath: sourceTracks[index]?.filePath,
                onQueueAction: (action) => {
                    handleTrackAction(index, action === "play-next" ? "play-next" : "enqueue");
                },
            });
        },
        [handleTrackAction, sourceTracks, trackContextMenuItems],
    );

    const handleNativeDragStart = useCallback(() => {
        skipClickRef.current = true;
    }, []);

    const getSelectionIndicesForDrag = useCallback(
        (activeIndex: number) => {
            const currentSelection = selectedIndices$.get();
            if (currentSelection.size > 1 && currentSelection.has(activeIndex)) {
                return Array.from(currentSelection).sort((a, b) => a - b);
            }

            return [activeIndex];
        },
        [selectedIndices$],
    );

    const buildDragData = useCallback(
        (activeIndex: number): MediaLibraryDragData => {
            const indices = getSelectionIndicesForDrag(activeIndex);
            const tracksToInclude = indices
                .map((trackIndex) => sourceTracks[trackIndex])
                .filter((track): track is LibraryTrack => Boolean(track))
                .map((track) => ({ ...track }));

            if (tracksToInclude.length === 0 && sourceTracks[activeIndex]) {
                tracksToInclude.push({ ...sourceTracks[activeIndex] });
            }

            return {
                type: "media-library-tracks",
                tracks: tracksToInclude,
            };
        },
        [getSelectionIndicesForDrag, sourceTracks],
    );

    const handleTrackClick = useCallback(
        (index: number, event?: NativeMouseEvent) => {
            if (skipClickRef.current) {
                skipClickRef.current = false;
                return;
            }

            handleSelectionClick(index, event);
        },
        [handleSelectionClick],
    );

    const handleTrackDoubleClick = useCallback(
        (index: number, event?: NativeMouseEvent) => {
            if (skipClickRef.current) {
                skipClickRef.current = false;
                return;
            }

            handleSelectionClick(index, event);

            if (event?.metaKey || event?.ctrlKey) {
                return;
            }

            const action = getQueueAction({ event });
            handleTrackAction(index, action);
        },
        [handleSelectionClick, handleTrackAction],
    );

    const keyExtractor = useCallback((item: TrackListItem) => item.id, []);

    return {
        tracks: trackItems,
        selectedIndices$,
        handleTrackClick,
        handleTrackDoubleClick,
        handleTrackContextMenu,
        handleNativeDragStart,
        buildDragData,
        keyExtractor,
        selectedItem,
    };
}

function formatDuration(value: string): string {
    if (!value) {
        return " ";
    }

    if (value.includes(":")) {
        return value;
    }

    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) {
        return value;
    }

    const mins = Math.floor(numeric / 60);
    const secs = Math.round(numeric % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
