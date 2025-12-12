import type { Observable } from "@legendapp/state";
import { useObserveEffect, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { NativeMouseEvent } from "react-native-macos";

import type { MediaLibraryDragData } from "@/components/dnd";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import type { TrackData } from "@/components/TrackItem";
import { usePlaylistSelection } from "@/hooks/usePlaylistSelection";
import { showContextMenu } from "@/native-modules/ContextMenu";
import {
    getArtistKey,
    library$,
    libraryUI$,
    normalizeArtistName,
    type LibraryTrack,
    type LibraryView,
} from "@/systems/LibraryState";
import { getQueueAction, type QueueAction } from "@/utils/queueActions";
import { buildTrackContextMenuItems, handleTrackContextMenuSelection } from "@/utils/trackContextMenu";

type TrackListItem = TrackData;
type LibraryTrackListItem = TrackData & { sourceTrack?: LibraryTrack };

interface UseLibraryTrackListResult {
    tracks: TrackData[];
    selectedIndices$: Observable<Set<number>>;
    handleTrackClick: (index: number, event?: NativeMouseEvent) => void;
    handleTrackDoubleClick: (index: number, event?: NativeMouseEvent) => void;
    handleTrackContextMenu: (index: number, event: NativeMouseEvent) => Promise<void>;
    handleTrackQueueAction: (index: number, action: QueueAction) => void;
    handleNativeDragStart: () => void;
    buildDragData: (activeIndex: number) => MediaLibraryDragData;
    keyExtractor: (item: TrackData) => string;
}

interface BuildTrackItemsInput {
    tracks: LibraryTrack[];
    selectedView: LibraryView;
    selectedPlaylistId: string | null;
    searchQuery: string;
}

export function buildTrackItems({ tracks, selectedView, selectedPlaylistId, searchQuery }: BuildTrackItemsInput) {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    void selectedPlaylistId;

    const toTrackItem = (track: LibraryTrack, viewIndex: number): LibraryTrackListItem => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: formatDuration(track.duration),
        thumbnail: track.thumbnail,
        index: viewIndex,
        sourceTrack: track,
    });

    if (selectedView === "starred") {
        return {
            trackItems: [] as LibraryTrackListItem[],
        };
    }

    if (normalizedQuery) {
        const filteredTracks = tracks.filter((track) => {
            const title = track.title?.toLowerCase() ?? "";
            const artist = track.artist?.toLowerCase() ?? "";
            const album = track.album?.toLowerCase() ?? "";
            return (
                title.includes(normalizedQuery) || artist.includes(normalizedQuery) || album.includes(normalizedQuery)
            );
        });

        return {
            trackItems: filteredTracks.map((track, index) => toTrackItem(track, index)),
        };
    }

    if (selectedView === "artists") {
        const sortedTracks = [...tracks].sort((a, b) => {
            const keyA = getArtistKey(a.artist);
            const keyB = getArtistKey(b.artist);
            if (keyA !== keyB) {
                return keyA.localeCompare(keyB);
            }

            return (a.title ?? "").localeCompare(b.title ?? "");
        });

        const trackItems: LibraryTrackListItem[] = [];
        let lastArtistKey: string | null = null;

        let viewIndex = 0;
        for (const track of sortedTracks) {
            const artistKey = getArtistKey(track.artist);
            if (artistKey !== lastArtistKey) {
                const displayName = normalizeArtistName(track.artist);
                trackItems.push({
                    id: `sep-artist-${artistKey}`,
                    title: `— ${displayName} —`,
                    artist: "",
                    album: "",
                    duration: "",
                    isSeparator: true,
                });
                lastArtistKey = artistKey;
            }

            trackItems.push(toTrackItem(track, viewIndex));
            viewIndex += 1;
        }

        return { trackItems };
    }

    if (selectedView === "albums") {
        const sortedTracks = [...tracks].sort((a, b) => {
            const albumA = a.album?.trim() || "Unknown Album";
            const albumB = b.album?.trim() || "Unknown Album";
            const keyA = albumA.toLowerCase();
            const keyB = albumB.toLowerCase();
            if (keyA !== keyB) {
                return keyA.localeCompare(keyB);
            }

            return (a.title ?? "").localeCompare(b.title ?? "");
        });

        const trackItems: LibraryTrackListItem[] = [];
        let lastAlbumKey: string | null = null;

        let viewIndex = 0;
        for (const track of sortedTracks) {
            const albumName = track.album?.trim() || "Unknown Album";
            const albumKey = albumName.toLowerCase();
            if (albumKey !== lastAlbumKey) {
                trackItems.push({
                    id: `sep-album-${albumKey}`,
                    title: `— ${albumName} —`,
                    artist: "",
                    album: "",
                    duration: "",
                    isSeparator: true,
                });
                lastAlbumKey = albumKey;
            }

            trackItems.push(toTrackItem(track, viewIndex));
            viewIndex += 1;
        }

        return { trackItems };
    }

    return {
        trackItems: tracks.map((track, index) => toTrackItem(track, index)),
    };
}

export function useLibraryTrackList(): UseLibraryTrackListResult {
    const selectedView = useValue(libraryUI$.selectedView);
    const selectedPlaylistId = useValue(libraryUI$.selectedPlaylistId);
    const searchQuery = useValue(libraryUI$.searchQuery);
    const allTracks = useValue(library$.tracks);
    const skipClickRef = useRef(false);

    const { trackItems } = useMemo(
        () =>
            buildTrackItems({
                tracks: allTracks,
                selectedView,
                selectedPlaylistId,
                searchQuery,
            }),
        [allTracks, searchQuery, selectedPlaylistId, selectedView],
    );

    const {
        selectedIndices$,
        handleTrackClick: handleSelectionClick,
        clearSelection,
    } = usePlaylistSelection({
        items: trackItems,
    });

    useObserveEffect(() => {
        libraryUI$.selectedView.get();
        libraryUI$.selectedPlaylistId.get();
        library$.tracks.get().length;
        clearSelection();
    });

    useEffect(() => {
        clearSelection();
    }, [trackItems.length]);

    const handleTrackAction = useCallback(
        (index: number, action: QueueAction) => {
            const track = trackItems[index]?.sourceTrack;
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
        [trackItems],
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
                filePath: trackItems[index]?.sourceTrack?.filePath,
                onQueueAction: (action) => {
                    handleTrackAction(index, action === "play-next" ? "play-next" : "enqueue");
                },
            });
        },
        [handleTrackAction, trackItems, trackContextMenuItems],
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
                .map((trackIndex) => trackItems[trackIndex]?.sourceTrack)
                .filter((track): track is LibraryTrack => Boolean(track))
                .map((track) => ({ ...track }));

            const activeTrack = trackItems[activeIndex]?.sourceTrack;
            if (tracksToInclude.length === 0 && activeTrack) {
                tracksToInclude.push({ ...activeTrack });
            }

            return {
                type: "media-library-tracks",
                tracks: tracksToInclude,
            };
        },
        [getSelectionIndicesForDrag, trackItems],
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
        handleTrackQueueAction: handleTrackAction,
        handleNativeDragStart,
        buildDragData,
        keyExtractor,
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
