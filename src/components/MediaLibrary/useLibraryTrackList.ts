import type { Observable } from "@legendapp/state";
import { useObserveEffect, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeMouseEvent } from "react-native-macos";
import { audioControls } from "@/components/AudioPlayer";
import type { MediaLibraryDragData } from "@/components/dnd";
import { showToast } from "@/components/Toast";
import type { TrackData } from "@/components/TrackItem";
import { usePlaylistSelection } from "@/hooks/usePlaylistSelection";
import { type ContextMenuItem, showContextMenu } from "@/native-modules/ContextMenu";
import { getStreamingProviderIdForUri, getStreamingProviderPlugin } from "@/providers/pluginRegistry";
import type { StreamingProviderId } from "@/providers/types";
import {
    getArtistKey,
    type LibraryTrack,
    type LibraryView,
    library$,
    libraryUI$,
    normalizeArtistName,
    resolveLibraryView,
    type PlaylistSortDirection,
    type PlaylistSortMode,
} from "@/systems/LibraryState";
import { type LocalPlaylist, localMusicState$, saveLocalPlaylistTracks } from "@/systems/LocalMusicState";
import { addTracksToPlaylist } from "@/systems/LocalPlaylists";
import { getQueueAction, type QueueAction } from "@/utils/queueActions";
import { buildTrackContextMenuItems, handleTrackContextMenuSelection } from "@/utils/trackContextMenu";
import { buildTrackFromPlaylistEntry, buildTrackLookup } from "@/utils/trackResolution";

type TrackListItem = TrackData;
type LibraryTrackListItem = TrackData & { sourceTrack?: LibraryTrack };

type LibrarySection = {
    id: string;
    title: string;
    tracks: LibraryTrack[];
};

const ADD_TO_PLAYLIST_MENU_ITEM: ContextMenuItem = { id: "add-to-playlist", title: "Add to Playlist…" };
const isLocalProviderTrack = (track?: { provider?: StreamingProviderId | null }): boolean =>
    !track?.provider || track.provider === "local";

const getSortableTrackNumber = (track: LibraryTrack): number | null => {
    const trackNumber = track.trackNumber;
    if (typeof trackNumber !== "number" || !Number.isFinite(trackNumber)) {
        return null;
    }
    return trackNumber;
};

const getAlbumSortInfo = (track: LibraryTrack): { key: string; displayName: string; isMissing: boolean } => {
    const trimmed = track.album?.trim() ?? "";
    if (!trimmed) {
        return { key: "__missing__", displayName: "Unknown Album", isMissing: true };
    }

    return { key: trimmed.toLowerCase(), displayName: trimmed, isMissing: false };
};

const compareTextValues = (valueA?: string, valueB?: string): number => {
    return (valueA ?? "").localeCompare(valueB ?? "");
};

const normalizeSortValue = (value?: string): string => (value ?? "").toLowerCase();

const applySortDirection = (value: number, direction: PlaylistSortDirection): number => {
    if (direction === "desc") {
        return value * -1;
    }
    return value;
};

const isUnknownArtistName = (name: string): boolean => name.trim().length === 0 || name === "Unknown Artist";

const sortTracksByField = (
    tracks: LibraryTrack[],
    field: "title" | "artist" | "album",
    direction: PlaylistSortDirection,
): LibraryTrack[] => {
    const indexedTracks = tracks.map((track, index) => ({ track, index }));
    indexedTracks.sort((a, b) => {
        const valueA = field === "artist" ? a.track.artist : field === "album" ? (a.track.album ?? "") : a.track.title;
        const valueB = field === "artist" ? b.track.artist : field === "album" ? (b.track.album ?? "") : b.track.title;
        const compare = applySortDirection(compareTextValues(valueA, valueB), direction);
        if (compare !== 0) {
            return compare;
        }
        const titleCompare = applySortDirection(compareTextValues(a.track.title, b.track.title), direction);
        if (titleCompare !== 0) {
            return titleCompare;
        }
        return a.index - b.index;
    });
    return indexedTracks.map(({ track }) => track);
};

const sortTracksByDateAdded = (tracks: LibraryTrack[], direction: PlaylistSortDirection): LibraryTrack[] => {
    const indexedTracks = tracks.map((track, index) => ({ track, index }));
    indexedTracks.sort((a, b) => {
        const addedA = typeof a.track.addedAt === "number" ? a.track.addedAt : null;
        const addedB = typeof b.track.addedAt === "number" ? b.track.addedAt : null;
        if (addedA != null && addedB != null && addedA !== addedB) {
            return applySortDirection(addedA - addedB, direction);
        }
        if (addedA != null && addedB == null) {
            return -1;
        }
        if (addedA == null && addedB != null) {
            return 1;
        }
        return a.index - b.index;
    });
    return indexedTracks.map(({ track }) => track);
};

const sortTracksByMode = (
    tracks: LibraryTrack[],
    mode: PlaylistSortMode,
    direction: PlaylistSortDirection,
): LibraryTrack[] => {
    if (mode === "playlist-order") {
        if (direction === "desc") {
            return [...tracks].reverse();
        }
        return tracks;
    }
    if (mode === "date-added") {
        return sortTracksByDateAdded(tracks, direction);
    }
    if (mode === "title" || mode === "artist" || mode === "album") {
        return sortTracksByField(tracks, mode, direction);
    }
    return tracks;
};

const sortTracksByAlbumThenTrackNumber = (tracks: LibraryTrack[], direction: PlaylistSortDirection): LibraryTrack[] =>
    [...tracks].sort((a, b) => {
        const albumInfoA = getAlbumSortInfo(a);
        const albumInfoB = getAlbumSortInfo(b);
        if (albumInfoA.isMissing !== albumInfoB.isMissing) {
            return albumInfoA.isMissing ? 1 : -1;
        }
        if (albumInfoA.key !== albumInfoB.key) {
            return applySortDirection(albumInfoA.key.localeCompare(albumInfoB.key), direction);
        }

        const trackNumberA = getSortableTrackNumber(a);
        const trackNumberB = getSortableTrackNumber(b);
        if (trackNumberA != null && trackNumberB != null && trackNumberA !== trackNumberB) {
            return applySortDirection(trackNumberA - trackNumberB, direction);
        }

        return applySortDirection(compareTextValues(a.title, b.title), direction);
    });

const sortTracksByTrackNumber = (tracks: LibraryTrack[], direction: PlaylistSortDirection): LibraryTrack[] =>
    [...tracks].sort((a, b) => {
        const trackNumberA = getSortableTrackNumber(a);
        const trackNumberB = getSortableTrackNumber(b);
        if (trackNumberA != null && trackNumberB != null && trackNumberA !== trackNumberB) {
            return applySortDirection(trackNumberA - trackNumberB, direction);
        }
        return applySortDirection(compareTextValues(a.title, b.title), direction);
    });

const sortArtistGroupTracks = (tracks: LibraryTrack[]): LibraryTrack[] =>
    sortTracksByAlbumThenTrackNumber(tracks, "asc");

const sortAlbumGroupTracks = (tracks: LibraryTrack[]): LibraryTrack[] => sortTracksByTrackNumber(tracks, "asc");

interface UseLibraryTrackListResult {
    tracks: TrackData[];
    sectionLookup: Map<string, LibrarySection>;
    handleSectionPlay: (sectionId: string) => void;
    handleSectionEnqueue: (sectionId: string) => void;
    selectedIndices$: Observable<Set<number>>;
    handleTrackClick: (index: number, event?: NativeMouseEvent) => void;
    handleTrackDoubleClick: (index: number, event?: NativeMouseEvent) => void;
    handleTrackContextMenu: (index: number, event: NativeMouseEvent) => Promise<void>;
    handleTrackQueueAction: (index: number, action: QueueAction) => void;
    syncSelectionAfterReorder: (fromIndex: number, toIndex: number) => void;
    handleNativeDragStart: () => void;
    buildDragData: (activeIndex: number) => MediaLibraryDragData;
    keyExtractor: (item: TrackData) => string;
}

interface BuildTrackItemsInput {
    tracks: LibraryTrack[];
    playlists: LocalPlaylist[];
    selectedView: LibraryView;
    selectedPlaylistId: string | null;
    selectedPlaylistProvider: StreamingProviderId | null;
    selectedPlaylistTracks?: LibraryTrack[];
    searchQuery: string;
    playlistSort: PlaylistSortMode;
    playlistSortDirection: PlaylistSortDirection;
}

export function buildTrackItems({
    tracks,
    playlists,
    selectedView,
    selectedPlaylistId,
    selectedPlaylistProvider,
    selectedPlaylistTracks,
    searchQuery,
    playlistSort,
    playlistSortDirection,
}: BuildTrackItemsInput) {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesQuery = (track: LibraryTrack): boolean => {
        if (!normalizedQuery) {
            return true;
        }

        const title = track.title?.toLowerCase() ?? "";
        const artist = track.artist?.toLowerCase() ?? "";
        const album = track.album?.toLowerCase() ?? "";
        return title.includes(normalizedQuery) || artist.includes(normalizedQuery) || album.includes(normalizedQuery);
    };

    const toTrackItem = (
        track: LibraryTrack,
        viewIndex: number,
        options?: {
            idOverride?: string;
            sectionId?: string;
            sectionTitle?: string;
            sectionIndex?: number;
            sectionCount?: number;
        },
    ): LibraryTrackListItem => ({
        id: options?.idOverride ?? track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: formatDuration(track.duration),
        thumbnail: track.thumbnail,
        isMissing: track.isMissing,
        addedAt: track.addedAt,
        provider: track.provider,
        index: viewIndex,
        trackIndex: track.trackNumber,
        sectionId: options?.sectionId,
        sectionTitle: options?.sectionTitle,
        sectionIndex: options?.sectionIndex,
        sectionCount: options?.sectionCount,
        sourceTrack: track,
    });

    const resolvedView = resolveLibraryView(selectedView);
    const effectiveSort =
        resolvedView === "library" && playlistSort === "playlist-order" ? "artist" : playlistSort;
    const effectiveSortDirection =
        resolvedView === "library" && playlistSort === "playlist-order" ? "asc" : playlistSortDirection;

    if (resolvedView === "starred") {
        return {
            trackItems: [] as LibraryTrackListItem[],
        };
    }

    const filteredTracks = normalizedQuery ? tracks.filter(matchesQuery) : tracks;

    const groupingMode =
        resolvedView === "library"
            ? effectiveSort === "artist"
                ? "artist"
                : effectiveSort === "album"
                  ? "album"
                  : "none"
            : "none";

    if (groupingMode === "artist") {
        const artistGroups = new Map<string, { displayName: string; tracks: LibraryTrack[] }>();

        for (const track of filteredTracks) {
            const artistKey = getArtistKey(track.artist);
            const displayName = normalizeArtistName(track.artist);
            const existing = artistGroups.get(artistKey);
            if (existing) {
                if (existing.displayName === "Unknown Artist" && displayName !== "Unknown Artist") {
                    existing.displayName = displayName;
                }
                existing.tracks.push(track);
            } else {
                artistGroups.set(artistKey, { displayName, tracks: [track] });
            }
        }

        const sortedGroups = Array.from(artistGroups.entries())
            .map((entry, index) => ({ entry, index }))
            .sort((a, b) => {
                const groupA = a.entry[1];
                const groupB = b.entry[1];
                const isUnknownA = isUnknownArtistName(groupA.displayName);
                const isUnknownB = isUnknownArtistName(groupB.displayName);
                if (isUnknownA !== isUnknownB) {
                    return isUnknownA ? 1 : -1;
                }
                const compare = compareTextValues(
                    normalizeSortValue(groupA.displayName),
                    normalizeSortValue(groupB.displayName),
                );
                if (compare !== 0) {
                    return applySortDirection(compare, effectiveSortDirection);
                }
                return a.index - b.index;
            })
            .map(({ entry }) => entry);
        const trackItems: LibraryTrackListItem[] = [];
        let viewIndex = 0;

        for (const [artistKey, group] of sortedGroups) {
            const groupTracks = sortArtistGroupTracks(group.tracks);
            const sectionId = `artist:${artistKey}`;
            trackItems.push({
                id: `section-${sectionId}`,
                title: `— ${group.displayName} —`,
                artist: "",
                duration: "",
                isSeparator: true,
                sectionId,
                sectionTitle: group.displayName,
                sectionCount: groupTracks.length,
            });
            let sectionIndex = 0;
            for (const track of groupTracks) {
                trackItems.push(
                    toTrackItem(track, viewIndex, {
                        sectionId,
                        sectionTitle: group.displayName,
                        sectionIndex,
                        sectionCount: groupTracks.length,
                    }),
                );
                viewIndex += 1;
                sectionIndex += 1;
            }
        }

        return { trackItems };
    }

    if (groupingMode === "album") {
        const albumGroups = new Map<
            string,
            { info: { key: string; displayName: string; isMissing: boolean }; tracks: LibraryTrack[] }
        >();

        for (const track of filteredTracks) {
            const albumInfo = getAlbumSortInfo(track);
            const existing = albumGroups.get(albumInfo.key);
            if (existing) {
                existing.tracks.push(track);
            } else {
                albumGroups.set(albumInfo.key, { info: albumInfo, tracks: [track] });
            }
        }

        const sortedGroups = Array.from(albumGroups.values())
            .map((group, index) => ({ group, index }))
            .sort((a, b) => {
                if (a.group.info.isMissing !== b.group.info.isMissing) {
                    return a.group.info.isMissing ? 1 : -1;
                }
                const compare = compareTextValues(a.group.info.key, b.group.info.key);
                if (compare !== 0) {
                    return applySortDirection(compare, effectiveSortDirection);
                }
                return a.index - b.index;
            })
            .map(({ group }) => group);

        const trackItems: LibraryTrackListItem[] = [];
        let viewIndex = 0;
        for (const group of sortedGroups) {
            const groupTracks = sortAlbumGroupTracks(group.tracks);
            const sectionId = `album:${group.info.key}`;
            trackItems.push({
                id: `section-${sectionId}`,
                title: `— ${group.info.displayName} —`,
                artist: "",
                duration: "",
                isSeparator: true,
                sectionId,
                sectionTitle: group.info.displayName,
                sectionCount: groupTracks.length,
            });
            let sectionIndex = 0;
            for (const track of groupTracks) {
                trackItems.push(
                    toTrackItem(track, viewIndex, {
                        sectionId,
                        sectionTitle: group.info.displayName,
                        sectionIndex,
                        sectionCount: groupTracks.length,
                    }),
                );
                viewIndex += 1;
                sectionIndex += 1;
            }
        }

        return { trackItems };
    }

    if (resolvedView === "library") {
        const sortedTracks = sortTracksByMode(filteredTracks, effectiveSort, effectiveSortDirection);
        return {
            trackItems: sortedTracks.map((track, index) => toTrackItem(track, index)),
        };
    }

    if (resolvedView === "playlist") {
        if (!selectedPlaylistId) {
            return { trackItems: [] as LibraryTrackListItem[] };
        }

        const shouldApplySort = playlistSort !== "playlist-order" || playlistSortDirection === "desc";
        const sortTracks = (inputTracks: LibraryTrack[]) => {
            if (!shouldApplySort) {
                return inputTracks;
            }

            return sortTracksByMode(inputTracks, playlistSort, playlistSortDirection);
        };

        const usedIds = new Set<string>();
        const makeUniqueId = (baseId: string) => {
            if (!usedIds.has(baseId)) {
                usedIds.add(baseId);
                return baseId;
            }

            let attempt = 2;
            let candidate = `${baseId}-${attempt}`;
            while (usedIds.has(candidate)) {
                attempt += 1;
                candidate = `${baseId}-${attempt}`;
            }
            usedIds.add(candidate);
            return candidate;
        };

        const buildPlaylistItems = (playlistTracks: LibraryTrack[]) => {
            const filteredTracks = normalizedQuery ? playlistTracks.filter(matchesQuery) : playlistTracks;
            const displayTracks = sortTracks(filteredTracks);
            return displayTracks.map((track, index) => {
                const baseItem = toTrackItem(track, index);
                const uniqueId = makeUniqueId(baseItem.id);
                if (uniqueId === baseItem.id) {
                    return baseItem;
                }
                return { ...baseItem, id: uniqueId };
            });
        };

        if (selectedPlaylistProvider && selectedPlaylistProvider !== "local") {
            return {
                trackItems: buildPlaylistItems(selectedPlaylistTracks ?? []),
            };
        }

        const playlist = playlists.find((pl) => pl.id === selectedPlaylistId);
        if (!playlist) {
            return { trackItems: [] as LibraryTrackListItem[] };
        }

        const trackLookup = buildTrackLookup(tracks);
        const makeMissingTrack = (path: string, titleOverride?: string, addedAt?: number): LibraryTrack => {
            const fileName = path.split("/").pop() || path;
            return {
                id: path,
                title: titleOverride || fileName,
                artist: "Missing Track",
                album: "",
                duration: "",
                filePath: path,
                fileName,
                isMissing: true,
                addedAt,
            };
        };

        const playlistEntries =
            playlist.tracks ??
            playlist.trackPaths.map((path) => ({
                id: path,
                duration: -1,
                title: path.split("/").pop() || path,
                filePath: path,
            }));

        const orderedTracks: LibraryTrack[] = playlistEntries.map((entry) => {
            const resolved = trackLookup.get(entry.filePath) as LibraryTrack | undefined;
            if (resolved) {
                if (entry.addedAt != null) {
                    return { ...resolved, addedAt: entry.addedAt };
                }
                return resolved;
            }

            const remoteProviderId = getStreamingProviderIdForUri(entry.filePath);
            if (remoteProviderId) {
                return buildTrackFromPlaylistEntry(entry, remoteProviderId) as LibraryTrack;
            }

            return makeMissingTrack(entry.filePath, entry.title, entry.addedAt);
        });

        return {
            trackItems: buildPlaylistItems(orderedTracks),
        };
    }

    return {
        trackItems: filteredTracks.map((track, index) => toTrackItem(track, index)),
    };
}

export function useLibraryTrackList(): UseLibraryTrackListResult {
    const selectedView = useValue(libraryUI$.selectedView);
    const selectedPlaylistId = useValue(libraryUI$.selectedPlaylistId);
    const selectedPlaylistProvider = useValue(libraryUI$.selectedPlaylistProvider);
    const searchQuery = useValue(libraryUI$.searchQuery);
    const playlistSort = useValue(libraryUI$.playlistSort);
    const playlistSortDirection = useValue(libraryUI$.playlistSortDirection);
    const allTracks = useValue(library$.tracks);
    const playlists = useValue(localMusicState$.playlists);
    const providerPlugin = selectedPlaylistProvider ? getStreamingProviderPlugin(selectedPlaylistProvider) : null;
    const [providerPlaylistTracks, setProviderPlaylistTracks] = useState<LibraryTrack[]>([]);
    const skipClickRef = useRef(false);

    useEffect(() => {
        if (
            selectedView !== "playlist" ||
            !selectedPlaylistProvider ||
            selectedPlaylistProvider === "local" ||
            !selectedPlaylistId
        ) {
            setProviderPlaylistTracks([]);
            return;
        }

        const listPlaylistTracks = providerPlugin?.library?.listPlaylistTracks;
        const toLocalTrack = providerPlugin?.tracks?.toLocalTrack;
        if (!listPlaylistTracks || !toLocalTrack) {
            setProviderPlaylistTracks([]);
            return;
        }

        let didCancel = false;

        void (async () => {
            try {
                const tracks = await listPlaylistTracks(selectedPlaylistId);
                if (didCancel) {
                    return;
                }
                setProviderPlaylistTracks(tracks.map((track, index) => toLocalTrack(track, { index })));
            } catch (error) {
                if (didCancel) {
                    return;
                }
                const providerName = providerPlugin?.provider.name ?? "provider";
                console.error(`Failed to load ${providerName} playlist tracks`, error);
                showToast(
                    error instanceof Error ? error.message : `Failed to load ${providerName} playlist tracks`,
                    "error",
                );
                setProviderPlaylistTracks([]);
            }
        })();

        return () => {
            didCancel = true;
        };
    }, [selectedView, providerPlugin, selectedPlaylistId, selectedPlaylistProvider]);

    const { trackItems } = useMemo(
        () =>
            buildTrackItems({
                tracks: allTracks,
                playlists,
                selectedView,
                selectedPlaylistId,
                selectedPlaylistProvider,
                selectedPlaylistTracks: providerPlaylistTracks,
                searchQuery,
                playlistSort,
                playlistSortDirection,
            }),
        [
            allTracks,
            playlists,
            playlistSort,
            playlistSortDirection,
            searchQuery,
            selectedPlaylistId,
            selectedPlaylistProvider,
            selectedView,
            providerPlaylistTracks,
        ],
    );

    const sectionLookup = useMemo(() => {
        const map = new Map<string, LibrarySection>();
        for (const item of trackItems) {
            if (!item.sectionId || !item.sourceTrack || item.isSeparator) {
                continue;
            }

            const existing = map.get(item.sectionId);
            if (existing) {
                existing.tracks.push(item.sourceTrack);
                continue;
            }

            map.set(item.sectionId, {
                id: item.sectionId,
                title: item.sectionTitle ?? "",
                tracks: [item.sourceTrack],
            });
        }
        return map;
    }, [trackItems]);

    const isSearchActive = searchQuery.trim().length > 0;
    const selectedPlaylist =
        selectedView === "playlist" && selectedPlaylistProvider === "local" && selectedPlaylistId
            ? (playlists.find((pl) => pl.id === selectedPlaylistId) ?? null)
            : null;
    const isPlaylistEditable =
        selectedView === "playlist" &&
        selectedPlaylist !== null &&
        selectedPlaylist.source === "cache" &&
        !isSearchActive &&
        playlistSort === "playlist-order" &&
        playlistSortDirection === "asc";

    const handleDeleteSelection = useCallback(
        (indices: number[]) => {
            if (!selectedPlaylist || !isPlaylistEditable || selectedView !== "playlist") {
                return;
            }

            const indicesToRemove = new Set(indices);
            const previousPaths = [...selectedPlaylist.trackPaths];
            const nextPaths = previousPaths.filter((_path, index) => !indicesToRemove.has(index));
            const removedCount = previousPaths.length - nextPaths.length;
            if (removedCount <= 0) {
                return;
            }

            saveLocalPlaylistTracks(selectedPlaylist, nextPaths);

            showToast(
                `Removed ${removedCount} ${removedCount === 1 ? "track" : "tracks"} from ${selectedPlaylist.name}`,
                "info",
                {
                    label: "Undo",
                    onPress: () => {
                        const latestPlaylist =
                            localMusicState$.playlists.peek().find((pl) => pl.id === selectedPlaylist.id) ??
                            selectedPlaylist;
                        saveLocalPlaylistTracks(latestPlaylist, previousPaths);
                    },
                },
            );
        },
        [isPlaylistEditable, selectedPlaylist, selectedView],
    );

    const selectionOptions =
        selectedView === "playlist" && selectedPlaylist && isPlaylistEditable
            ? { items: trackItems, onDeleteSelection: handleDeleteSelection }
            : { items: trackItems };

    const {
        selectedIndices$,
        handleTrackClick: handleSelectionClick,
        clearSelection,
        syncSelectionAfterReorder,
    } = usePlaylistSelection(selectionOptions);

    useObserveEffect(() => {
        libraryUI$.selectedView.get();
        libraryUI$.selectedPlaylistId.get();
        libraryUI$.selectedPlaylistProvider.get();
        libraryUI$.playlistSort.get();
        libraryUI$.playlistSortDirection.get();
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
                    audioControls.queue.insertNext(track, { playImmediately: true });
                    break;
                case "play-next":
                    audioControls.queue.insertNext(track);
                    break;
                default:
                    audioControls.queue.append(track);
                    break;
            }
        },
        [trackItems],
    );

    const handleSectionPlay = useCallback(
        (sectionId: string) => {
            const section = sectionLookup.get(sectionId);
            if (!section || section.tracks.length === 0) {
                return;
            }

            audioControls.queue.replace(section.tracks, { startIndex: 0, playImmediately: true });
        },
        [sectionLookup],
    );

    const handleSectionEnqueue = useCallback(
        (sectionId: string) => {
            const section = sectionLookup.get(sectionId);
            if (!section || section.tracks.length === 0) {
                return;
            }

            audioControls.queue.append(section.tracks);
        },
        [sectionLookup],
    );

    const handleTrackContextMenu = useCallback(
        async (index: number, event: NativeMouseEvent) => {
            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;
            const sourceTrack = trackItems[index]?.sourceTrack;
            if (!sourceTrack) {
                return;
            }
            const isRemoteTrack = !isLocalProviderTrack(sourceTrack);
            const menuItems = buildTrackContextMenuItems({
                track: sourceTrack,
                includeQueueActions: true,
                extraItems: isRemoteTrack ? [] : [ADD_TO_PLAYLIST_MENU_ITEM],
            });
            if (menuItems.length === 0) {
                return;
            }
            const selection = await showContextMenu(menuItems, { x, y });

            await handleTrackContextMenuSelection({
                selection,
                track: sourceTrack,
                anchorRect: { screenX: x, screenY: y, width: 1, height: 1 },
                onQueueAction: (action) => {
                    handleTrackAction(index, action === "play-next" ? "play-next" : "enqueue");
                },
                onCustomSelect: async (customSelection) => {
                    if (customSelection !== ADD_TO_PLAYLIST_MENU_ITEM.id) {
                        return;
                    }

                    if (!isLocalProviderTrack(sourceTrack)) {
                        return;
                    }

                    const selectablePlaylists = playlists.filter(
                        (playlist) => playlist.source === "cache" && Boolean(playlist.filePath),
                    );
                    if (selectablePlaylists.length === 0) {
                        showToast("No editable playlists available", "error");
                        return;
                    }

                    const playlistSelectionItems: ContextMenuItem[] = playlists.map((playlist) => ({
                        id: `playlist:${playlist.id}`,
                        title: playlist.name,
                        enabled: playlist.source === "cache" && Boolean(playlist.filePath),
                    }));
                    const playlistSelection = await showContextMenu(playlistSelectionItems, { x, y });
                    if (!playlistSelection?.startsWith("playlist:")) {
                        return;
                    }

                    const playlistId = playlistSelection.replace(/^playlist:/, "");
                    const currentSelection = selectedIndices$.get();
                    const indicesToAdd =
                        currentSelection.size > 0 && currentSelection.has(index)
                            ? Array.from(currentSelection).sort((a, b) => a - b)
                            : [index];

                    const trackPaths = indicesToAdd
                        .map((trackIndex) => trackItems[trackIndex]?.sourceTrack?.filePath)
                        .filter((path): path is string => Boolean(path));
                    if (trackPaths.length === 0) {
                        return;
                    }

                    try {
                        const { addedPaths, playlist } = await addTracksToPlaylist(playlistId, trackPaths);
                        const addedCount = addedPaths.length;
                        if (addedCount <= 0) {
                            showToast("No new tracks to add", "info");
                            return;
                        }

                        showToast(
                            `Added ${addedCount} ${addedCount === 1 ? "track" : "tracks"} to ${playlist.name}`,
                            "info",
                            {
                                label: "Undo",
                                onPress: () => {
                                    const latestPlaylist =
                                        localMusicState$.playlists.peek().find((pl) => pl.id === playlist.id) ?? null;
                                    if (!latestPlaylist) {
                                        return;
                                    }

                                    const addedKeys = new Set(addedPaths.map((path) => path.toLowerCase()));
                                    const nextPaths = latestPlaylist.trackPaths.filter(
                                        (path) => !addedKeys.has(path.toLowerCase()),
                                    );
                                    saveLocalPlaylistTracks(latestPlaylist, nextPaths);
                                },
                            },
                        );
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Failed to add tracks to playlist";
                        showToast(message, "error");
                    }
                },
            });
        },
        [handleTrackAction, playlists, selectedIndices$, trackItems],
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
                .filter(isLocalProviderTrack)
                .map((track) => ({ ...track }));

            const activeTrack = trackItems[activeIndex]?.sourceTrack;
            if (tracksToInclude.length === 0 && isLocalProviderTrack(activeTrack)) {
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

            const shouldEnqueueOnShift = selectedView !== "playlist";
            if (event?.shiftKey && shouldEnqueueOnShift) {
                handleSelectionClick(index);
                handleTrackAction(index, "enqueue");
                return;
            }

            handleSelectionClick(index, event);
        },
        [handleSelectionClick, handleTrackAction, selectedView],
    );

    const handleTrackDoubleClick = useCallback(
        (index: number, event?: NativeMouseEvent) => {
            if (skipClickRef.current) {
                skipClickRef.current = false;
                return;
            }

            const shouldEnqueueOnShift = selectedView !== "playlist";
            if (event?.shiftKey && shouldEnqueueOnShift) {
                handleSelectionClick(index);
                handleTrackAction(index, "enqueue");
                return;
            }

            handleSelectionClick(index, event);

            if (event?.metaKey || event?.ctrlKey) {
                return;
            }

            const item = trackItems[index];
            if (item?.sectionId) {
                const section = sectionLookup.get(item.sectionId);
                if (section && section.tracks.length > 0) {
                    const startIndex =
                        typeof item.sectionIndex === "number"
                            ? Math.max(0, Math.min(item.sectionIndex, section.tracks.length - 1))
                            : 0;
                    audioControls.queue.replace(section.tracks, { startIndex, playImmediately: true });
                    return;
                }
            }

            const action = getQueueAction({ event });
            handleTrackAction(index, action);
        },
        [handleSelectionClick, handleTrackAction, sectionLookup, selectedView, trackItems],
    );

    const keyExtractor = useCallback((item: TrackListItem) => item.id, []);

    return {
        tracks: trackItems,
        sectionLookup,
        handleSectionPlay,
        handleSectionEnqueue,
        selectedIndices$,
        handleTrackClick,
        handleTrackDoubleClick,
        handleTrackContextMenu,
        handleTrackQueueAction: handleTrackAction,
        syncSelectionAfterReorder,
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
