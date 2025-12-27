import type { Observable } from "@legendapp/state";
import { useObserveEffect, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { NativeMouseEvent } from "react-native-macos";

import type { MediaLibraryDragData } from "@/components/dnd";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import { showToast } from "@/components/Toast";
import type { TrackData } from "@/components/TrackItem";
import { usePlaylistSelection } from "@/hooks/usePlaylistSelection";
import { type ContextMenuItem, showContextMenu } from "@/native-modules/ContextMenu";
import { fetchSpotifyPlaylistTracks, isSpotifyAuthenticated$, spotifyPlaylists$ } from "@/providers/spotify";
import type { ProviderId, ProviderTrack } from "@/providers/types";
import {
    getArtistKey,
    type LibraryTrack,
    type LibraryView,
    library$,
    libraryUI$,
    normalizeArtistName,
    type PlaylistSortMode,
} from "@/systems/LibraryState";
import { type LocalPlaylist, localMusicState$, saveLocalPlaylistTracks } from "@/systems/LocalMusicState";
import { addTracksToPlaylist } from "@/systems/LocalPlaylists";
import { formatSecondsToMmSs } from "@/utils/m3u";
import { getQueueAction, type QueueAction } from "@/utils/queueActions";
import { buildTrackContextMenuItems, handleTrackContextMenuSelection } from "@/utils/trackContextMenu";
import { buildTrackLookup } from "@/utils/trackResolution";

type TrackListItem = TrackData;
type LibraryTrackListItem = TrackData & { sourceTrack?: LibraryTrack };

const ADD_TO_PLAYLIST_MENU_ITEM: ContextMenuItem = { id: "add-to-playlist", title: "Add to Playlist…" };

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

const buildSpotifyLibraryTrack = (track: ProviderTrack, index: number): LibraryTrack => {
    const durationSeconds = typeof track.durationMs === "number" ? track.durationMs / 1000 : 0;
    const duration = durationSeconds ? formatSecondsToMmSs(durationSeconds) : " ";
    const uri = track.uri ?? track.id;

    return {
        id: uri,
        title: track.name,
        artist: (track.artists ?? []).join(", "),
        album: track.album,
        duration,
        filePath: uri,
        fileName: track.name,
        thumbnail: track.thumbnail,
        provider: "spotify",
        uri: track.uri,
        durationMs: track.durationMs,
        trackNumber: index + 1,
    };
};

interface UseLibraryTrackListResult {
    tracks: TrackData[];
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
    selectedPlaylistProvider: ProviderId | null;
    selectedPlaylistTracks?: LibraryTrack[];
    searchQuery: string;
    playlistSort: PlaylistSortMode;
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

    const toTrackItem = (track: LibraryTrack, viewIndex: number, idOverride?: string): LibraryTrackListItem => ({
        id: idOverride ?? track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: formatDuration(track.duration),
        thumbnail: track.thumbnail,
        isMissing: track.isMissing,
        index: viewIndex,
        trackIndex: track.trackNumber,
        sourceTrack: track,
    });

    if (selectedView === "starred") {
        return {
            trackItems: [] as LibraryTrackListItem[],
        };
    }

    const filteredTracks = normalizedQuery ? tracks.filter(matchesQuery) : tracks;

    if (selectedView === "artists") {
        const sortedTracks = [...filteredTracks].sort((a, b) => {
            const keyA = getArtistKey(a.artist);
            const keyB = getArtistKey(b.artist);
            if (keyA !== keyB) {
                return keyA.localeCompare(keyB);
            }

            const albumInfoA = getAlbumSortInfo(a);
            const albumInfoB = getAlbumSortInfo(b);
            if (albumInfoA.isMissing !== albumInfoB.isMissing) {
                return albumInfoA.isMissing ? 1 : -1;
            }
            if (albumInfoA.key !== albumInfoB.key) {
                return albumInfoA.key.localeCompare(albumInfoB.key);
            }

            const trackNumberA = getSortableTrackNumber(a);
            const trackNumberB = getSortableTrackNumber(b);
            if (trackNumberA != null && trackNumberB != null && trackNumberA !== trackNumberB) {
                return trackNumberA - trackNumberB;
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
        const sortedTracks = [...filteredTracks].sort((a, b) => {
            const albumInfoA = getAlbumSortInfo(a);
            const albumInfoB = getAlbumSortInfo(b);
            if (albumInfoA.isMissing !== albumInfoB.isMissing) {
                return albumInfoA.isMissing ? 1 : -1;
            }
            if (albumInfoA.key !== albumInfoB.key) {
                return albumInfoA.key.localeCompare(albumInfoB.key);
            }

            const trackNumberA = getSortableTrackNumber(a);
            const trackNumberB = getSortableTrackNumber(b);
            if (trackNumberA != null && trackNumberB != null && trackNumberA !== trackNumberB) {
                return trackNumberA - trackNumberB;
            }

            return (a.title ?? "").localeCompare(b.title ?? "");
        });

        const trackItems: LibraryTrackListItem[] = [];
        let lastAlbumKey: string | null = null;

        let viewIndex = 0;
        for (const track of sortedTracks) {
            const albumInfo = getAlbumSortInfo(track);
            if (albumInfo.key !== lastAlbumKey) {
                trackItems.push({
                    id: `sep-album-${albumInfo.key}`,
                    title: `— ${albumInfo.displayName} —`,
                    artist: "",
                    album: "",
                    duration: "",
                    isSeparator: true,
                });
                lastAlbumKey = albumInfo.key;
            }

            trackItems.push(toTrackItem(track, viewIndex));
            viewIndex += 1;
        }

        return { trackItems };
    }

    if (selectedView === "playlist") {
        if (!selectedPlaylistId) {
            return { trackItems: [] as LibraryTrackListItem[] };
        }

        const shouldApplySort = !normalizedQuery && playlistSort !== "playlist-order";
        const sortTracks = (inputTracks: LibraryTrack[]) =>
            shouldApplySort
                ? [...inputTracks].sort((a, b) => {
                      const valueA =
                          playlistSort === "artist" ? a.artist : playlistSort === "album" ? (a.album ?? "") : a.title;
                      const valueB =
                          playlistSort === "artist" ? b.artist : playlistSort === "album" ? (b.album ?? "") : b.title;
                      const compare = (valueA ?? "").localeCompare(valueB ?? "");
                      if (compare !== 0) {
                          return compare;
                      }
                      return (a.title ?? "").localeCompare(b.title ?? "");
                  })
                : inputTracks;

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

        if (selectedPlaylistProvider === "spotify") {
            return {
                trackItems: buildPlaylistItems(selectedPlaylistTracks ?? []),
            };
        }

        const playlist = playlists.find((pl) => pl.id === selectedPlaylistId);
        if (!playlist) {
            return { trackItems: [] as LibraryTrackListItem[] };
        }

        const trackLookup = buildTrackLookup(tracks);
        const makeMissingTrack = (path: string): LibraryTrack => {
            const fileName = path.split("/").pop() || path;
            return {
                id: path,
                title: fileName,
                artist: "Missing Track",
                album: "",
                duration: "",
                filePath: path,
                fileName,
                isMissing: true,
            };
        };

        const orderedTracks: LibraryTrack[] = playlist.trackPaths.map(
            (path) => (trackLookup.get(path) as LibraryTrack | undefined) ?? makeMissingTrack(path),
        );

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
    const allTracks = useValue(library$.tracks);
    const playlists = useValue(localMusicState$.playlists);
    const spotifyTracksByPlaylistId = useValue(spotifyPlaylists$.tracksByPlaylistId);
    const spotifyTracksFetchedAtByPlaylistId = useValue(spotifyPlaylists$.tracksFetchedAtByPlaylistId);
    const isSpotifyAuthenticated = useValue(isSpotifyAuthenticated$);
    const skipClickRef = useRef(false);

    const spotifyPlaylistTracks = useMemo(() => {
        if (selectedPlaylistProvider !== "spotify" || !selectedPlaylistId) {
            return [] as LibraryTrack[];
        }

        const tracks = spotifyTracksByPlaylistId[selectedPlaylistId] ?? [];
        return tracks.map((track, index) => buildSpotifyLibraryTrack(track, index));
    }, [selectedPlaylistId, selectedPlaylistProvider, spotifyTracksByPlaylistId]);

    useEffect(() => {
        if (selectedView !== "playlist" || selectedPlaylistProvider !== "spotify" || !selectedPlaylistId) {
            return;
        }

        if (!isSpotifyAuthenticated) {
            return;
        }

        if (spotifyTracksFetchedAtByPlaylistId[selectedPlaylistId]) {
            return;
        }

        void fetchSpotifyPlaylistTracks(selectedPlaylistId).catch((error) => {
            console.error("Failed to load Spotify playlist tracks", error);
            showToast(
                error instanceof Error ? error.message : "Failed to load Spotify playlist tracks",
                "error",
            );
        });
    }, [
        isSpotifyAuthenticated,
        selectedPlaylistId,
        selectedPlaylistProvider,
        selectedView,
        spotifyTracksFetchedAtByPlaylistId,
    ]);

    const { trackItems } = useMemo(
        () =>
            buildTrackItems({
                tracks: allTracks,
                playlists,
                selectedView,
                selectedPlaylistId,
                selectedPlaylistProvider,
                selectedPlaylistTracks: spotifyPlaylistTracks,
                searchQuery,
                playlistSort,
            }),
        [
            allTracks,
            playlists,
            playlistSort,
            searchQuery,
            selectedPlaylistId,
            selectedPlaylistProvider,
            selectedView,
            spotifyPlaylistTracks,
        ],
    );

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
        playlistSort === "playlist-order";

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

    const handleTrackContextMenu = useCallback(
        async (index: number, event: NativeMouseEvent) => {
            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;
            const sourceTrack = trackItems[index]?.sourceTrack;
            const isSpotifyTrack = sourceTrack?.provider === "spotify";
            const menuItems = buildTrackContextMenuItems({
                includeQueueActions: true,
                includeFinder: !isSpotifyTrack,
                extraItems: isSpotifyTrack ? [] : [ADD_TO_PLAYLIST_MENU_ITEM],
            });
            const selection = await showContextMenu(menuItems, { x, y });

            await handleTrackContextMenuSelection({
                selection,
                filePath: isSpotifyTrack ? null : sourceTrack?.filePath,
                onQueueAction: (action) => {
                    handleTrackAction(index, action === "play-next" ? "play-next" : "enqueue");
                },
                onCustomSelect: async (customSelection) => {
                    if (customSelection !== ADD_TO_PLAYLIST_MENU_ITEM.id) {
                        return;
                    }

                    if (sourceTrack?.provider === "spotify") {
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
                .filter((track) => track.provider !== "spotify")
                .map((track) => ({ ...track }));

            const activeTrack = trackItems[activeIndex]?.sourceTrack;
            if (tracksToInclude.length === 0 && activeTrack && activeTrack.provider !== "spotify") {
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
