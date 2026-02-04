import { LegendList } from "@legendapp/list";
import { type Observable, observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { type ElementRef, useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, Text, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";
import { audioPlayerState$ } from "@/components/AudioPlayer";
import { Button } from "@/components/Button";
import {
    type DragData,
    DraggableItem,
    type DraggedItem,
    DroppableZone,
    LOCAL_PLAYLIST_DRAG_ZONE_ID,
    type LocalPlaylistDragData,
    MEDIA_LIBRARY_DRAG_ZONE_ID,
    type MediaLibraryDragData,
} from "@/components/dnd";
import { SkiaSpinner } from "@/components/SkiaSpinner";
import { Table, TableCell, type TableColumnSpec, TableHeader, TableRow } from "@/components/Table";
import { showToast } from "@/components/Toast";
import type { TrackData } from "@/components/TrackItem";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { type ContextMenuItem, showContextMenu } from "@/native-modules/ContextMenu";
import { NativeButton } from "@/native-modules/NativeButton";
import { TitlebarAccessoryView } from "@/native-modules/TitlebarAccessoryView";
import { type NativeDragTrack, TrackDragSource } from "@/native-modules/TrackDragSource";
import { getStreamingProviderPlugin } from "@/providers/pluginRegistry";
import type { StreamingProviderPlaylist } from "@/providers/types";
import { aiPlaylistFillState$ } from "@/systems/ai";
import { type AiGenerationPopupAnchorRect, openAiGenerationPopup } from "@/systems/ai/generationPopup";
import { Icon } from "@/systems/Icon";
import {
    getArtistKey,
    type LibrarySortMode,
    libraryNavigation$,
    libraryUI$,
    type PlaylistSortMode,
    resolveLibraryView,
} from "@/systems/LibraryState";
import { localMusicState$, saveLocalPlaylistTracks } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import { themeState$ } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import type { QueueAction } from "@/utils/queueActions";
import { handleTrackContextMenuSelection, TRACK_CONTEXT_MENU_ITEMS } from "@/utils/trackContextMenu";
import { useWindowId } from "@/windows/WindowProvider";
import { AiPlaylistDropdown } from "./AiPlaylistDropdown";
import { useLibraryTrackList } from "./useLibraryTrackList";

type TrackListProps = {};

const emptyProviderPlaylists$ = observable([] as StreamingProviderPlaylist[]);
const DEFAULT_AI_SUGGESTION_COUNT = 10;
type LegendListHandle = ElementRef<typeof LegendList> & {
    scrollToIndex?: (params: { index: number; animated?: boolean }) => void;
};

const formatAddedDate = (timestamp?: number): string => {
    if (!timestamp) {
        return "";
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const getItemType = (item: TrackData) => {
    return item.isSeparator ? "separator" : "track";
};

const getFixedItemSize = (_: number, item: TrackData) => {
    return item.isSeparator ? 32 : 32;
};

export function TrackList(_props: TrackListProps) {
    const {
        tracks,
        selectedIndices$,
        handleTrackClick,
        handleTrackDoubleClick,
        handleTrackContextMenu,
        handleTrackQueueAction,
        handleSectionPlay,
        handleSectionEnqueue,
        syncSelectionAfterReorder,
        clearSelection,
        selectIndex,
        handleNativeDragStart,
        buildDragData,
        keyExtractor,
    } = useLibraryTrackList();

    const selectedView = useValue(libraryUI$.selectedView);
    const resolvedView = resolveLibraryView(selectedView);
    const selectedPlaylistId = useValue(libraryUI$.selectedPlaylistId);
    const selectedPlaylistProvider = useValue(libraryUI$.selectedPlaylistProvider);
    const searchQuery = useValue(libraryUI$.searchQuery);
    const librarySort = useValue(libraryUI$.librarySort);
    const librarySortDirection = useValue(libraryUI$.librarySortDirection);
    const playlistSort = useValue(libraryUI$.playlistSort);
    const playlistSortDirection = useValue(libraryUI$.playlistSortDirection);
    const pendingJump = useValue(libraryNavigation$.pendingJump);
    const effectiveSort = resolvedView === "library" ? librarySort : playlistSort;
    const effectiveSortDirection = resolvedView === "library" ? librarySortDirection : playlistSortDirection;
    const playlists = useValue(localMusicState$.playlists);
    const aiPlaylistFillState = useValue(aiPlaylistFillState$);
    const providerPlugin = selectedPlaylistProvider ? getStreamingProviderPlugin(selectedPlaylistProvider) : null;
    const providerPlaylists = useValue(providerPlugin?.library?.playlists$ ?? emptyProviderPlaylists$);
    const listRef = useRef<LegendListHandle>(null);
    const didMountRef = useRef(false);
    const showAiCreateButton = resolvedView === "playlist" && selectedPlaylistProvider === "local";
    const showAiFillSpinner =
        resolvedView === "playlist" &&
        selectedPlaylistProvider === "local" &&
        aiPlaylistFillState.isGenerating &&
        aiPlaylistFillState.playlistId === selectedPlaylistId;

    const nonSeparatorTrackCount = useMemo(
        () => tracks.reduce((count, track) => (track.isSeparator ? count : count + 1), 0),
        [tracks],
    );

    const selectedLocalPlaylist = useMemo(() => {
        if (resolvedView !== "playlist" || selectedPlaylistProvider !== "local" || !selectedPlaylistId) {
            return null;
        }

        return playlists.find((pl) => pl.id === selectedPlaylistId) ?? null;
    }, [playlists, resolvedView, selectedPlaylistId, selectedPlaylistProvider]);

    const defaultPromptSource = useValue(settings$.ai.promptSource);
    const windowId = useWindowId();
    const aiPrompt = selectedLocalPlaylist?.aiPrompt?.trim() ?? "";
    const aiSummary = selectedLocalPlaylist?.aiSummary?.trim() ?? "";
    const playlistPromptSource = selectedLocalPlaylist?.aiSource ?? defaultPromptSource;
    const showAiSummary = Boolean(aiPrompt && aiSummary);
    const canModifyPlaylist = Boolean(selectedLocalPlaylist && selectedLocalPlaylist.source === "cache");
    const extendButtonRef = useRef<View>(null);

    const selectedProviderPlaylist = useMemo(() => {
        if (
            resolvedView !== "playlist" ||
            !selectedPlaylistProvider ||
            selectedPlaylistProvider === "local" ||
            !selectedPlaylistId
        ) {
            return null;
        }

        return providerPlaylists.find((pl) => pl.id === selectedPlaylistId) ?? null;
    }, [providerPlaylists, resolvedView, selectedPlaylistId, selectedPlaylistProvider]);

    const headerConfig = useMemo(() => {
        if (resolvedView === "playlist") {
            if (selectedPlaylistProvider === "local" && selectedLocalPlaylist) {
                return { title: selectedLocalPlaylist.name, count: selectedLocalPlaylist.trackCount };
            }

            if (selectedPlaylistProvider && selectedPlaylistProvider !== "local") {
                return {
                    title: selectedProviderPlaylist?.name ?? "Playlist",
                    count: selectedProviderPlaylist?.trackCount ?? nonSeparatorTrackCount,
                };
            }
        }

        if (resolvedView === "library") {
            const title = librarySort === "artist" ? "Artists" : librarySort === "album" ? "Albums" : "Songs";
            return { title, count: nonSeparatorTrackCount };
        }

        return null;
    }, [
        nonSeparatorTrackCount,
        librarySort,
        selectedLocalPlaylist,
        selectedPlaylistProvider,
        selectedProviderPlaylist,
        resolvedView,
    ]);

    const isAiBusy =
        aiPlaylistFillState.isGenerating &&
        Boolean(selectedPlaylistId) &&
        aiPlaylistFillState.playlistId === selectedPlaylistId;
    const canExtendWithNewPrompt = Boolean(canModifyPlaylist && !isAiBusy);

    const handleOpenExtendPrompt = useCallback(() => {
        if (!selectedLocalPlaylist || !canModifyPlaylist) {
            return;
        }

        const openWithAnchor = (anchorRect: AiGenerationPopupAnchorRect | null) => {
            openAiGenerationPopup({
                title: "Extend with new prompt",
                action: "extend-playlist",
                targetPlaylistId: selectedLocalPlaylist.id,
                initialPromptSource: playlistPromptSource,
                anchorRect,
                windowId,
            });
        };

        const node = extendButtonRef.current;
        if (node?.measureInWindow) {
            node.measureInWindow((x, y, width, height) => {
                if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
                    openWithAnchor(null);
                    return;
                }

                openWithAnchor({
                    screenX: Math.round(x + width / 2),
                    screenY: Math.round(y + height),
                    width: 1,
                    height: 1,
                });
            });
            return;
        }

        openWithAnchor(null);
    }, [canModifyPlaylist, playlistPromptSource, selectedLocalPlaylist, windowId]);

    const handleEmptySpaceClick = useCallback(
        (event: NativeMouseEvent) => {
            if (event.button !== 0) {
                return;
            }

            const selectedCount = selectedIndices$.get().size;
            if (selectedCount === 0 || selectedCount !== nonSeparatorTrackCount) {
                return;
            }

            clearSelection();
        },
        [clearSelection, nonSeparatorTrackCount, selectedIndices$],
    );

    const isPlaylistEditable =
        resolvedView === "playlist" &&
        selectedPlaylistProvider === "local" &&
        selectedLocalPlaylist !== null &&
        selectedLocalPlaylist.source === "cache" &&
        playlistSort === "playlist-order" &&
        playlistSortDirection === "asc" &&
        searchQuery.trim().length === 0;

    const showExtendButtons =
        resolvedView === "playlist" &&
        selectedPlaylistProvider === "local" &&
        Boolean(selectedLocalPlaylist) &&
        canModifyPlaylist;

    const showDateAddedColumn = resolvedView === "playlist";

    const columns = useMemo<TableColumnSpec[]>(() => {
        const numberSortId = resolvedView === "playlist" ? "playlist-order" : undefined;
        const nextColumns: TableColumnSpec[] = [
            { id: "number", label: "#", width: 28, align: "right", sortId: numberSortId },
            { id: "title", label: "Title", flex: 3, minWidth: 120, sortId: "title" },
            { id: "artist", label: "Artist", flex: 2, minWidth: 100, sortId: "artist" },
            { id: "album", label: "Album", flex: 2, minWidth: 100, sortId: "album" },
        ];

        if (showDateAddedColumn) {
            nextColumns.push({ id: "date-added", label: "Date added", width: 120, sortId: "date-added" });
        }

        nextColumns.push(
            { id: "duration", label: "Duration", width: 64, align: "right" },
            { id: "source", width: 28, align: "center" },
        );

        return nextColumns;
    }, [resolvedView, showDateAddedColumn]);
    const handleColumnSort = useCallback(
        (sortId: string) => {
            const isPlaylistView = resolvedView === "playlist";
            const allowedSorts = isPlaylistView
                ? ["playlist-order", "date-added", "title", "artist", "album"]
                : ["title", "artist", "album"];
            if (!allowedSorts.includes(sortId)) {
                return;
            }

            const currentSort = isPlaylistView ? playlistSort : librarySort;
            const currentDirection = isPlaylistView ? playlistSortDirection : librarySortDirection;
            const updateSort = (nextSort: string, nextDirection: "asc" | "desc") => {
                if (isPlaylistView) {
                    libraryUI$.playlistSort.set(nextSort as PlaylistSortMode);
                    libraryUI$.playlistSortDirection.set(nextDirection);
                    return;
                }
                libraryUI$.librarySort.set(nextSort as LibrarySortMode);
                libraryUI$.librarySortDirection.set(nextDirection);
            };

            if (sortId === currentSort) {
                const nextDirection = currentDirection === "asc" ? "desc" : "asc";
                updateSort(sortId, nextDirection);
                return;
            }

            const defaultDirection = sortId === "date-added" ? "desc" : "asc";
            updateSort(sortId, defaultDirection);
        },
        [librarySort, librarySortDirection, playlistSort, playlistSortDirection, resolvedView],
    );

    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }

        if (pendingJump) {
            return;
        }

        listRef.current?.scrollToIndex?.({ index: 0 });
    }, [effectiveSort, effectiveSortDirection, pendingJump, resolvedView]);

    useEffect(() => {
        if (!pendingJump || pendingJump.type !== "artist") {
            return;
        }

        if (resolvedView !== "library") {
            return;
        }

        if (tracks.length === 0) {
            return;
        }

        const sectionId = `artist:${pendingJump.artistKey}`;
        const sectionIndex = tracks.findIndex((item) => item.isSeparator && item.sectionId === sectionId);
        const performJump = (scrollIndex: number, selectTrackIndex: number | null) => {
            requestAnimationFrame(() => {
                listRef.current?.scrollToIndex?.({ index: scrollIndex, animated: true });
            });

            if (selectTrackIndex != null && selectTrackIndex >= 0) {
                selectIndex(selectTrackIndex);
            }

            libraryNavigation$.pendingJump.set(null);
        };

        if (sectionIndex >= 0) {
            const firstTrackIndex = tracks.findIndex(
                (item, index) => index > sectionIndex && !item.isSeparator && item.sectionId === sectionId,
            );
            performJump(sectionIndex, firstTrackIndex >= 0 ? firstTrackIndex : null);
            return;
        }

        const fallbackIndex = tracks.findIndex(
            (item) => !item.isSeparator && getArtistKey(item.artist) === pendingJump.artistKey,
        );
        if (fallbackIndex >= 0) {
            performJump(fallbackIndex, fallbackIndex);
            return;
        }

        libraryNavigation$.pendingJump.set(null);
    }, [pendingJump, resolvedView, selectIndex, tracks]);

    const allowPlaylistDrop = useCallback(
        (item: DraggedItem<DragData>) => {
            if (!isPlaylistEditable || !selectedLocalPlaylist) {
                return false;
            }

            const data = item.data;
            if (!data) {
                return false;
            }

            if (data.type === "local-playlist-track" && item.sourceZoneId === LOCAL_PLAYLIST_DRAG_ZONE_ID) {
                return data.playlistId === selectedLocalPlaylist.id;
            }

            if (data.type === "media-library-tracks" && item.sourceZoneId === MEDIA_LIBRARY_DRAG_ZONE_ID) {
                return data.tracks.length > 0;
            }

            return false;
        },
        [isPlaylistEditable, selectedLocalPlaylist],
    );

    const handleDropAtPosition = useCallback(
        async (item: DraggedItem<DragData>, targetPosition: number) => {
            if (!isPlaylistEditable || !selectedLocalPlaylist) {
                return;
            }

            const data = item.data;
            const currentPaths = selectedLocalPlaylist.trackPaths;
            const boundedTarget = Math.max(0, Math.min(targetPosition, currentPaths.length));

            if (data.type === "local-playlist-track") {
                if (data.playlistId !== selectedLocalPlaylist.id) {
                    return;
                }

                const sourceIndex = Math.max(0, Math.min(data.sourceIndex, currentPaths.length - 1));
                if (
                    sourceIndex === boundedTarget ||
                    (sourceIndex < boundedTarget && sourceIndex + 1 === boundedTarget)
                ) {
                    return;
                }

                const nextPaths = currentPaths.slice();
                const [movedPath] = nextPaths.splice(sourceIndex, 1);
                const insertIndex = boundedTarget > sourceIndex ? boundedTarget - 1 : boundedTarget;
                nextPaths.splice(insertIndex, 0, movedPath);

                await saveLocalPlaylistTracks(selectedLocalPlaylist, nextPaths);
                syncSelectionAfterReorder(sourceIndex, boundedTarget);
                return;
            }

            if (data.type === "media-library-tracks") {
                const insertPaths = data.tracks.map((track) => track.filePath);
                const nextPaths = currentPaths.slice();
                nextPaths.splice(boundedTarget, 0, ...insertPaths);
                await saveLocalPlaylistTracks(selectedLocalPlaylist, nextPaths);
            }
        },
        [isPlaylistEditable, selectedLocalPlaylist, syncSelectionAfterReorder],
    );

    const renderTrack = useCallback(
        ({ item, index }: { item: TrackData; index: number }) => {
            if (item.isSeparator) {
                const sectionId = item.sectionId;
                return (
                    <LibrarySectionRow
                        title={item.sectionTitle ?? item.title}
                        count={item.sectionCount ?? 0}
                        onPlay={sectionId ? () => handleSectionPlay(sectionId) : undefined}
                        onEnqueue={sectionId ? () => handleSectionEnqueue(sectionId) : undefined}
                    />
                );
            }

            const trackPathForPlaylist =
                isPlaylistEditable && selectedLocalPlaylist
                    ? (selectedLocalPlaylist.trackPaths[index] ?? item.id)
                    : null;

            const trackRow = (
                <LibraryTrackRow
                    track={item}
                    index={index}
                    columns={columns}
                    onClick={handleTrackClick}
                    onDoubleClick={handleTrackDoubleClick}
                    onRightClick={handleTrackContextMenu}
                    onMenuAction={handleTrackQueueAction}
                    onEnqueue={(trackIndex) => handleTrackQueueAction(trackIndex, "enqueue")}
                    selectedIndices$={selectedIndices$}
                    buildDragData={buildDragData}
                    onNativeDragStart={handleNativeDragStart}
                    isPlaylistEditable={isPlaylistEditable}
                    playlistId={selectedLocalPlaylist?.id ?? null}
                    trackPath={trackPathForPlaylist}
                />
            );

            if (isPlaylistEditable && Platform.OS !== "macos") {
                return (
                    <View>
                        {trackRow}
                        <LocalPlaylistDropZone
                            position={index + 1}
                            allowDrop={allowPlaylistDrop}
                            onDrop={handleDropAtPosition}
                        />
                    </View>
                );
            }

            return trackRow;
        },
        [
            allowPlaylistDrop,
            buildDragData,
            handleTrackClick,
            handleTrackDoubleClick,
            handleTrackContextMenu,
            handleTrackQueueAction,
            handleSectionEnqueue,
            handleSectionPlay,
            handleNativeDragStart,
            handleDropAtPosition,
            isPlaylistEditable,
            selectedLocalPlaylist,
            selectedIndices$,
            columns,
        ],
    );

    return (
        <View className="flex-1 pl-2 relative">
            {headerConfig ? (
                <TitlebarAccessoryView>
                    <View className="px-3 py-2 flex-row items-center gap-3">
                        <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                            {headerConfig.title}
                        </Text>
                        <Text className="text-xs text-text-secondary" numberOfLines={1}>
                            ({headerConfig.count})
                        </Text>
                        {showAiSummary ? (
                            <View className="max-w-[45%] items-end">
                                <Text className="text-xs text-text-secondary text-right" numberOfLines={1}>
                                    ✨ {aiSummary}
                                </Text>
                            </View>
                        ) : null}
                        <View className="flex-1" />
                        {showExtendButtons ? (
                            <View ref={extendButtonRef} collapsable={false}>
                                <NativeButton
                                    sfSymbol="wand.and.sparkles"
                                    onPress={handleOpenExtendPrompt}
                                    disabled={!canExtendWithNewPrompt}
                                    style={{ width: 28, height: 28 }}
                                />
                            </View>
                        ) : null}
                    </View>
                </TitlebarAccessoryView>
            ) : null}
            <Table
                header={
                    <TableHeader
                        columns={columns}
                        activeSortId={effectiveSort}
                        activeSortDirection={effectiveSortDirection}
                        onColumnClick={handleColumnSort}
                    />
                }
            >
                <LegendList
                    key={resolvedView}
                    ref={listRef}
                    data={tracks}
                    keyExtractor={keyExtractor}
                    renderItem={renderTrack}
                    getItemType={getItemType}
                    getFixedItemSize={getFixedItemSize}
                    maintainVisibleContentPosition={false}
                    ListHeaderComponent={
                        isPlaylistEditable && Platform.OS !== "macos" ? (
                            <LocalPlaylistDropZone
                                position={0}
                                allowDrop={allowPlaylistDrop}
                                onDrop={handleDropAtPosition}
                            />
                        ) : undefined
                    }
                    style={{ flex: 1 }}
                    contentContainerStyle={
                        tracks.length
                            ? { flexGrow: 1 }
                            : {
                                  flexGrow: 1,
                                  justifyContent: "center",
                                  alignItems: "flex-start",
                                  paddingVertical: 16,
                              }
                    }
                    ListFooterComponent={
                        tracks.length ? <Button className="flex-1" onClick={handleEmptySpaceClick} /> : null
                    }
                    ListFooterComponentStyle={tracks.length ? { flexGrow: 1 } : undefined}
                    recycleItems
                    ListEmptyComponent={
                        <View className="items-center justify-center py-4 px-2.5 w-full gap-2">
                            <Text className="text-sm text-white/60">No tracks found</Text>
                            {showAiCreateButton ? (
                                <AiPlaylistDropdown
                                    buttonLabel="Create with AI"
                                    buttonVariant="secondary"
                                    buttonSize="small"
                                />
                            ) : null}
                        </View>
                    }
                />
            </Table>
            {showAiFillSpinner ? (
                <View pointerEvents="none" className="absolute left-4 right-4 bottom-3">
                    <View className="flex-row items-center gap-2 rounded-md bg-background-tertiary border border-border-primary px-3 py-2">
                        <SkiaSpinner size={18} color="#7dd6ff" trailColor="rgba(255,255,255,0.08)" />
                        <Text className="text-sm text-text-secondary">Generating AI tracks...</Text>
                    </View>
                </View>
            ) : null}
        </View>
    );
}

function LibrarySectionRow({
    title,
    count,
    onPlay,
    onEnqueue,
}: {
    title: string;
    count: number;
    onPlay?: () => void;
    onEnqueue?: () => void;
}) {
    const displayTitle = title.replace(/^— (.+) —$/, "$1");
    const hasActions = Boolean(onPlay || onEnqueue);

    return (
        <View className="border-b border-t border-border-primary flex-row items-center justify-between gap-2 group h-8">
            <View className="pl-2 flex-1 flex-row items-center gap-2 min-w-0">
                <Text className="text-text-tertiary shrink" numberOfLines={1}>
                    {displayTitle}
                </Text>
                <Text className="text-xs text-text-tertiary" numberOfLines={1}>
                    {count}
                </Text>
            </View>
            {hasActions ? (
                <View className="pr-2 flex-row items-center gap-1 opacity-0 group-hover:opacity-100">
                    {onEnqueue ? (
                        <Button
                            icon="plus"
                            variant="icon"
                            size="small"
                            tooltip={`Queue all ${displayTitle}`}
                            onClick={onEnqueue}
                        />
                    ) : null}
                    {onPlay ? (
                        <Button
                            icon="play.fill"
                            variant="icon"
                            size="small"
                            tooltip={`Play all ${displayTitle}`}
                            onClick={onPlay}
                        />
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

interface LocalPlaylistDropZoneProps {
    position: number;
    allowDrop: (item: DraggedItem<DragData>) => boolean;
    onDrop: (item: DraggedItem<DragData>, position: number) => void;
}

function LocalPlaylistDropZone({ position, allowDrop, onDrop }: LocalPlaylistDropZoneProps) {
    const dropId = `local-playlist-drop-${position}`;
    const isFirstZone = position === 0;

    return (
        <DroppableZone
            id={dropId}
            allowDrop={(item) => allowDrop(item as DraggedItem<DragData>)}
            onDrop={(item) => onDrop(item as DraggedItem<DragData>, position)}
        >
            {(isActive) => (
                <View
                    pointerEvents="none"
                    className={cn("h-[3px] rounded-full bg-blue-500", isFirstZone ? "-mb-[3px]" : "-mt-[3px]")}
                    style={{ opacity: isActive ? 1 : 0 }}
                />
            )}
        </DroppableZone>
    );
}

interface LibraryTrackRowProps {
    track: TrackData;
    index: number;
    columns: TableColumnSpec[];
    onClick: (index: number, event?: NativeMouseEvent) => void;
    onDoubleClick: (index: number, event?: NativeMouseEvent) => void;
    onRightClick: (index: number, event: NativeMouseEvent) => void;
    onMenuAction: (index: number, action: QueueAction) => void;
    onEnqueue: (index: number) => void;
    selectedIndices$: Observable<Set<number>>;
    buildDragData: (activeIndex: number) => MediaLibraryDragData;
    onNativeDragStart: () => void;
    isPlaylistEditable: boolean;
    playlistId: string | null;
    trackPath: string | null;
}

const buildTrackRowMenuItems = (track: TrackData): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
        { id: "play-now", title: "Play Now" },
        { id: "play-next", title: "Play Next" },
    ];

    items.push(TRACK_CONTEXT_MENU_ITEMS.startMix, TRACK_CONTEXT_MENU_ITEMS.addMoreLikeThis);

    if (track.artist?.trim()) {
        items.push(TRACK_CONTEXT_MENU_ITEMS.goToArtist);
    }

    if (track.album?.trim()) {
        items.push(TRACK_CONTEXT_MENU_ITEMS.goToAlbum);
    }

    items.push({ id: "star", title: "Star", enabled: false });
    return items;
};

function LibraryTrackRow({
    track,
    index,
    columns,
    onClick,
    onDoubleClick,
    onRightClick,
    onMenuAction,
    onEnqueue,
    selectedIndices$,
    buildDragData,
    onNativeDragStart,
    isPlaylistEditable,
    playlistId,
    trackPath,
}: LibraryTrackRowProps) {
    const dragData = buildDragData(index);
    const listItemStyles = useListItemStyles();
    const windowId = useWindowId();
    const isSelected = useValue(() => selectedIndices$.get().has(index));
    const isPlaying = useValue(() => {
        const currentTrack = audioPlayerState$.currentTrack.get();
        return currentTrack ? currentTrack.id === track.id : false;
    });
    const accentColor = useValue(() => themeState$.customColors.dark.accent.primary.get());
    const displayIndex = track.trackIndex;
    const numberColumn = columns.find((column) => column.id === "number");
    const titleColumn = columns.find((column) => column.id === "title");
    const artistColumn = columns.find((column) => column.id === "artist");
    const albumColumn = columns.find((column) => column.id === "album");
    const dateAddedColumn = columns.find((column) => column.id === "date-added");
    const durationColumn = columns.find((column) => column.id === "duration");
    const sourceColumn = columns.find((column) => column.id === "source");
    const addedAtLabel = formatAddedDate(track.addedAt);
    const ProviderBadge = track.provider ? (getStreamingProviderPlugin(track.provider)?.ui?.badge ?? null) : null;
    const providerBadgeNode = ProviderBadge ? <ProviderBadge size={12} className="opacity-80" /> : null;

    const handleMenuClick = useCallback(
        async (event: NativeMouseEvent) => {
            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;
            const menuItems = buildTrackRowMenuItems(track);
            const selection = await showContextMenu(menuItems, { x, y });
            if (!selection) {
                return;
            }

            if (selection === "play-now" || selection === "play-next") {
                onMenuAction(index, selection);
                return;
            }

            await handleTrackContextMenuSelection({
                selection,
                // TrackData is compatible with LocalTrack fields used by handlers.
                track: track as any,
                anchorRect: { screenX: x, screenY: y, width: 1, height: 1 },
                windowId,
            });
        },
        [index, onMenuAction, track, windowId],
    );

    const handleQuickEnqueue = useCallback(() => {
        onEnqueue(index);
    }, [index, onEnqueue]);

    const row = (
        <TableRow
            className="w-full group px-0"
            isSelected={isSelected}
            isActive={isPlaying}
            onClick={(event) => onClick(index, event)}
            onDoubleClick={(event) => onDoubleClick(index, event)}
            onRightClick={(event) => onRightClick(index, event)}
        >
            <TableCell column={numberColumn}>
                {isPlaying ? (
                    <Icon name="play.fill" size={12} color={accentColor} />
                ) : displayIndex != null ? (
                    <Text className={cn("text-xs tabular-nums", listItemStyles.text.muted)}>{displayIndex}</Text>
                ) : null}
            </TableCell>
            <TableCell column={titleColumn}>
                <Text className={cn("text-sm font-medium truncate", listItemStyles.text.primary)} numberOfLines={1}>
                    {track.title}
                </Text>
            </TableCell>
            <TableCell column={artistColumn}>
                <Text className={cn("text-sm truncate", listItemStyles.text.secondary)} numberOfLines={1}>
                    {track.artist}
                </Text>
            </TableCell>
            <TableCell column={albumColumn}>
                <Text className={cn("text-sm truncate", listItemStyles.text.secondary)} numberOfLines={1}>
                    {track.album ?? ""}
                </Text>
            </TableCell>
            {dateAddedColumn ? (
                <TableCell column={dateAddedColumn}>
                    <Text className={cn("text-xs truncate", listItemStyles.text.secondary)} numberOfLines={1}>
                        {addedAtLabel || "-"}
                    </Text>
                </TableCell>
            ) : null}
            <TableCell column={durationColumn}>
                <Text className={listItemStyles.getMetaClassName({ className: "text-xs" })}>{track.duration}</Text>
            </TableCell>
            <TableCell column={sourceColumn}>{providerBadgeNode}</TableCell>
            <View className="flex-row items-center px-1 mr-1 absolute right-0 opacity-0 group-hover:opacity-100 bg-background-secondary rounded-xl">
                <Button
                    icon="plus"
                    variant="icon"
                    size="small"
                    accessibilityLabel="Enqueue track"
                    tooltip="Queue track"
                    onClick={handleQuickEnqueue}
                />
                <Button
                    icon="ellipsis"
                    variant="icon"
                    size="small"
                    accessibilityLabel="Track actions"
                    onClick={handleMenuClick}
                />
            </View>
        </TableRow>
    );

    if (Platform.OS === "macos") {
        return (
            <TrackDragSource
                tracks={dragData.tracks as NativeDragTrack[]}
                onDragStart={onNativeDragStart}
                className="flex-1"
            >
                {row}
            </TrackDragSource>
        );
    }

    if (isPlaylistEditable && playlistId && trackPath) {
        const playlistDragData = {
            type: "local-playlist-track",
            playlistId,
            trackPath,
            sourceIndex: index,
        } satisfies LocalPlaylistDragData;

        return (
            <DraggableItem
                id={`local-playlist-track-${playlistId}-${index}`}
                zoneId={LOCAL_PLAYLIST_DRAG_ZONE_ID}
                data={playlistDragData}
                className="flex-1"
            >
                {row}
            </DraggableItem>
        );
    }

    return (
        <DraggableItem
            id={`library-track-${track.id}`}
            zoneId={MEDIA_LIBRARY_DRAG_ZONE_ID}
            data={() => dragData}
            className="flex-1"
        >
            {row}
        </DraggableItem>
    );
}
