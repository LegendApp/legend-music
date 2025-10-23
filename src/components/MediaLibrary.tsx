import { LegendList } from "@legendapp/list";
import type { Observable } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, Text, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";
import { Button } from "@/components/Button";
import { DraggableItem, MEDIA_LIBRARY_DRAG_ZONE_ID, type MediaLibraryDragData } from "@/components/dnd";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import { Panel, PanelGroup, ResizeHandle } from "@/components/ResizablePanels";
import { TextInputSearch, type TextInputSearchRef } from "@/components/TextInputSearch";
import { type TrackData, TrackItem } from "@/components/TrackItem";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { type ContextMenuItem, showContextMenu } from "@/native-modules/ContextMenu";
import { type NativeDragTrack, TrackDragSource } from "@/native-modules/TrackDragSource";
import { Icon } from "@/systems/Icon";
import type { LibraryItem, LibraryTrack } from "@/systems/LibraryState";
import { library$, libraryUI$ } from "@/systems/LibraryState";
import { settings$ } from "@/systems/Settings";
import type { SFSymbols } from "@/types/SFSymbols";
import { cn } from "@/utils/cn";
import { perfCount, perfLog } from "@/utils/perfLogger";
import { getTracksForLibraryItem } from "@/utils/trackResolution";

const MEDIA_LIBRARY_CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
    { id: "queue-add", title: "Add to Queue" },
    { id: "queue-play-next", title: "Play Next" },
];

export function MediaLibraryView() {
    perfCount("MediaLibraryView.render");
    const searchQuery = use$(libraryUI$.searchQuery);
    const searchInputRef = useRef<TextInputSearchRef>(null);
    const showHints = use$(settings$.general.showHints);

    const handleClearSearch = useCallback(() => {
        libraryUI$.searchQuery.set("");
        searchInputRef.current?.focus();
    }, []);

    return (
        <View className="flex-1 min-w-[360px] min-h-0 bg-black/5 border-l border-white/10">
            <View className="px-3 pt-3 pb-2">
                <View className="relative">
                    <View className="bg-background-tertiary border border-border-primary rounded-md px-3 py-1.5 pr-10">
                        <TextInputSearch
                            ref={searchInputRef}
                            value$={libraryUI$.searchQuery}
                            placeholder="Search library"
                            className="text-sm text-text-primary"
                        />
                    </View>
                    {searchQuery ? (
                        <View className="absolute inset-y-0 right-2 flex-row items-center">
                            <Button
                                icon="xmark.circle.fill"
                                variant="icon"
                                size="small"
                                accessibilityLabel="Clear search"
                                onClick={handleClearSearch}
                                className="bg-transparent hover:bg-white/10"
                            />
                        </View>
                    ) : null}
                </View>
            </View>
            <View className="flex-1">
                <PanelGroup direction="horizontal">
                    <Panel
                        id="sidebar"
                        minSize={80}
                        maxSize={300}
                        defaultSize={200}
                        order={0}
                        className="border-r border-white/10"
                    >
                        <LibraryTree searchQuery={searchQuery} />
                    </Panel>

                    <ResizeHandle panelId="sidebar" />

                    <Panel id="tracklist" minSize={80} defaultSize={200} order={1} flex>
                        <TrackList searchQuery={searchQuery} />
                    </Panel>
                </PanelGroup>
            </View>
            {showHints ? (
                <View className="border-t border-white/15 bg-black/20 px-3 py-2">
                    <Text className="text-xs text-white/60">Shift click to play next</Text>
                </View>
            ) : null}
        </View>
    );
}

interface LibraryTreeProps {
    searchQuery: string;
}

function LibraryTree({ searchQuery }: LibraryTreeProps) {
    perfCount("MediaLibrary.LibraryTree.render");
    const selectedItem = use$(libraryUI$.selectedItem);
    const selectedCollection = use$(libraryUI$.selectedCollection);
    const artists = use$(library$.artists);
    const albums = use$(library$.albums);
    const playlists = use$(library$.playlists);
    const tracks = use$(library$.tracks);
    const listItemStyles = useListItemStyles();

    const selectItem = useCallback((item: LibraryItem | null) => {
        libraryUI$.selectedItem.set(item);
    }, []);

    const allSongsItem = useMemo<LibraryItem>(
        () => ({
            id: "all-songs",
            type: "playlist",
            name: "All Songs",
            trackCount: tracks.length,
        }),
        [tracks.length],
    );

    const getTracksForItem = useCallback(
        (item: LibraryItem | null): LibraryTrack[] => {
            return getTracksForLibraryItem(tracks, item, { allTracksPlaylistId: allSongsItem.id });
        },
        [allSongsItem.id, tracks],
    );

    const handleItemContextMenu = useCallback(
        async (item: LibraryItem, event: NativeMouseEvent) => {
            const button = event?.button;
            const isSecondaryClick = typeof button === "number" ? button !== 0 : false;
            const isCtrlClick = event?.ctrlKey === true;
            if (!isSecondaryClick && !isCtrlClick) {
                return;
            }

            const tracksForItem = getTracksForItem(item);
            if (tracksForItem.length === 0) {
                return;
            }

            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;

            const selection = await showContextMenu(MEDIA_LIBRARY_CONTEXT_MENU_ITEMS, { x, y });
            if (!selection) {
                return;
            }

            if (selection === "queue-play-next") {
                localAudioControls.queue.insertNext(tracksForItem);
            } else {
                localAudioControls.queue.append(tracksForItem);
            }
        },
        [getTracksForItem],
    );

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const computeCollectionItems = useCallback(
        (collection: "artists" | "albums" | "playlists") => {
            let items: LibraryItem[];
            switch (collection) {
                case "albums":
                    items = albums;
                    break;
                case "playlists":
                    items = [allSongsItem, ...playlists];
                    break;
                default:
                    items = artists;
                    break;
            }

            if (!normalizedQuery) {
                return items;
            }

            return items.filter((item) => {
                if (item.id === allSongsItem.id) {
                    return true;
                }

                return item.name.toLowerCase().includes(normalizedQuery);
            });
        },
        [albums, allSongsItem, artists, normalizedQuery, playlists],
    );

    const collectionItems = useMemo(
        () => computeCollectionItems(selectedCollection),
        [computeCollectionItems, selectedCollection],
    );

    useEffect(() => {
        const collectionTypeMap: Record<string, LibraryItem["type"][]> = {
            artists: ["artist"],
            albums: ["album"],
            playlists: ["playlist"],
        };
        const allowedTypes = collectionTypeMap[selectedCollection] ?? ["artist"];
        if (normalizedQuery) {
            return;
        }
        if (!selectedItem || !allowedTypes.includes(selectedItem.type)) {
            const nextSelection = collectionItems[0] ?? null;
            libraryUI$.selectedItem.set(nextSelection);
        }
    }, [collectionItems, normalizedQuery, selectedCollection, selectedItem]);

    const handleCollectionChange = useCallback(
        (collection: "artists" | "albums" | "playlists") => {
            libraryUI$.selectedCollection.set(collection);
            if (normalizedQuery) {
                return;
            }

            const itemsForCollection = computeCollectionItems(collection);
            const nextSelection = itemsForCollection[0] ?? null;
            libraryUI$.selectedItem.set(nextSelection);
        },
        [computeCollectionItems, normalizedQuery],
    );

    const renderRow = useCallback(
        ({ item }: { item: LibraryItem }) => {
            const isSelected = selectedItem?.id === item.id;
            return (
                <Button
                    onClick={() => selectItem(item)}
                    onMouseDown={(event) => {
                        void handleItemContextMenu(item, event);
                    }}
                    className={listItemStyles.getRowClassName({
                        variant: "compact",
                        isActive: isSelected,
                    })}
                >
                    <View className="flex-1 flex-row items-center justify-between overflow-hidden">
                        <Text
                            className={cn(
                                "text-sm truncate flex-1 pr-4",
                                isSelected ? listItemStyles.text.primary : listItemStyles.text.secondary,
                            )}
                            numberOfLines={1}
                        >
                            {item.name}
                        </Text>
                        {item.trackCount ? (
                            <View className="shrink-0">
                                <Text className={listItemStyles.getMetaClassName({ className: "text-xs" })}>
                                    {item.trackCount}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </Button>
            );
        },
        [handleItemContextMenu, listItemStyles, selectItem, selectedItem?.id],
    );

    const collectionTabs: Array<{ id: "artists" | "albums" | "playlists"; label: string; icon: SFSymbols }> = useMemo(
        () => [
            { id: "artists", label: "Artists", icon: "person.crop.circle" },
            { id: "albums", label: "Albums", icon: "opticaldisc" },
            { id: "playlists", label: "Playlists", icon: "music.note.list" },
        ],
        [],
    );

    const emptyLabel = useMemo(() => {
        const tab = collectionTabs.find((item) => item.id === selectedCollection);
        return tab?.label.toLowerCase() ?? "items";
    }, [collectionTabs, selectedCollection]);

    return (
        <View className="flex-1 min-h-0">
            <View className="mb-1 flex-row gap-1.5">
                {collectionTabs.map((tab) => (
                    <Button
                        key={tab.id}
                        onClick={() => handleCollectionChange(tab.id)}
                        className={listItemStyles.getRowClassName({
                            variant: "compact",
                            isActive: selectedCollection === tab.id,
                            className: "flex-1 items-center justify-center px-2",
                        })}
                        accessibilityLabel={tab.label}
                    >
                        <Icon
                            name={tab.icon}
                            size={17}
                            marginTop={-8}
                            color={selectedCollection === tab.id ? undefined : "rgba(255,255,255,0.55)"}
                        />
                    </Button>
                ))}
            </View>

            <LegendList
                data={collectionItems}
                keyExtractor={(item) => item.id}
                renderItem={renderRow}
                style={{ flex: 1 }}
                contentContainerStyle={{ alignItems: "stretch" }}
                estimatedItemSize={44}
                waitForInitialLayout={false}
                ListEmptyComponent={
                    <View className="py-4 px-2">
                        <Text className="mt-3 text-xs text-white/40">No {emptyLabel} found</Text>
                    </View>
                }
            />
        </View>
    );
}

interface TrackListProps {
    searchQuery: string;
}

function TrackList({ searchQuery }: TrackListProps) {
    perfCount("MediaLibrary.TrackList.render");
    const selectedItem = use$(libraryUI$.selectedItem);
    const allTracks = use$(library$.tracks);
    const selectedIndices$ = useObservable<Set<number>>(new Set());
    const skipClickRef = useRef(false);

    const { trackItems, sourceTracks } = useMemo(() => {
        perfLog("MediaLibrary.TrackList.useMemo", {
            selectedItem,
            allTracks: allTracks.length,
            searchQuery,
        });
        const normalizedQuery = (searchQuery ?? "").trim().toLowerCase();

        if (!selectedItem && !normalizedQuery) {
            return { trackItems: [] as TrackData[], sourceTracks: [] as LibraryTrack[] };
        }

        let filteredTracks: LibraryTrack[];
        if (normalizedQuery) {
            filteredTracks = allTracks;
        } else if (selectedItem?.type === "artist") {
            filteredTracks = allTracks.filter((track) => track.artist === selectedItem.name);
        } else if (selectedItem?.type === "album") {
            const albumName = selectedItem.album ?? selectedItem.name;
            filteredTracks = allTracks.filter((track) => (track.album ?? "Unknown Album") === albumName);
        } else if (selectedItem?.type === "playlist") {
            filteredTracks = allTracks;
        } else {
            filteredTracks = allTracks;
        }

        if (normalizedQuery) {
            filteredTracks = filteredTracks.filter((track) => {
                const title = track.title?.toLowerCase() ?? "";
                const artist = track.artist?.toLowerCase() ?? "";
                const album = track.album?.toLowerCase() ?? "";
                return (
                    title.includes(normalizedQuery) ||
                    artist.includes(normalizedQuery) ||
                    album.includes(normalizedQuery)
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
    }, [allTracks, searchQuery, selectedItem]);

    const tracks = trackItems;

    const keyExtractor = useCallback((item: TrackData) => item.id, []);

    const clearSelection = useCallback(() => {
        selectedIndices$.set(new Set());
    }, [selectedIndices$]);

    useEffect(() => {
        clearSelection();
    }, [clearSelection, selectedItem?.id, trackItems.length]);

    const handleTrackAction = useCallback(
        (index: number, action: "enqueue" | "play-next") => {
            const track = sourceTracks[index];
            if (!track) {
                return;
            }

            perfLog("MediaLibrary.handleTrackAction", { trackId: track.id, action });
            if (action === "play-next") {
                localAudioControls.queue.insertNext(track);
            } else {
                localAudioControls.queue.append(track);
            }
        },
        [sourceTracks],
    );

    const handleTrackContextMenu = useCallback(
        async (index: number, event: NativeMouseEvent) => {
            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;

            const selection = await showContextMenu(MEDIA_LIBRARY_CONTEXT_MENU_ITEMS, { x, y });
            if (!selection) {
                return;
            }

            if (selection === "queue-play-next") {
                handleTrackAction(index, "play-next");
            } else {
                handleTrackAction(index, "enqueue");
            }
        },
        [handleTrackAction],
    );

    const getActionFromEvent = useCallback((event?: NativeMouseEvent): "enqueue" | "play-next" => {
        return event?.shiftKey ? "play-next" : "enqueue";
    }, []);

    const handleTrackClick = useCallback(
        (index: number, event?: NativeMouseEvent) => {
            if (skipClickRef.current) {
                skipClickRef.current = false;
                return;
            }

            const action = getActionFromEvent(event);
            handleTrackAction(index, action);
        },
        [getActionFromEvent, handleTrackAction],
    );

    const toggleSelection = useCallback(
        (index: number) => {
            const nextSelection = new Set(selectedIndices$.get());
            if (nextSelection.has(index)) {
                nextSelection.delete(index);
            } else {
                nextSelection.add(index);
            }
            selectedIndices$.set(nextSelection);
        },
        [selectedIndices$],
    );

    const setSingleSelection = useCallback(
        (index: number) => {
            selectedIndices$.set(new Set([index]));
        },
        [selectedIndices$],
    );

    const handleTrackMouseDown = useCallback(
        (index: number, event: NativeMouseEvent) => {
            if (event.metaKey) {
                skipClickRef.current = true;
                toggleSelection(index);
                return;
            }

            skipClickRef.current = false;
            setSingleSelection(index);
        },
        [setSingleSelection, toggleSelection],
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

    const renderTrack = useCallback(
        ({ item, index }: { item: TrackData; index: number }) => (
            <LibraryTrackRow
                track={item}
                index={index}
                onClick={handleTrackClick}
                onRightClick={handleTrackContextMenu}
                onMouseDown={handleTrackMouseDown}
                selectedIndices$={selectedIndices$}
                buildDragData={buildDragData}
                onNativeDragStart={handleNativeDragStart}
            />
        ),
        [
            buildDragData,
            handleTrackClick,
            handleTrackContextMenu,
            handleTrackMouseDown,
            handleNativeDragStart,
            selectedIndices$,
        ],
    );

    if (!selectedItem) {
        return (
            <View className="flex-1 min-h-0 justify-center items-start px-2.5">
                <Text className="text-sm text-white/60 text-left">Select an item to view tracks</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 min-h-0">
            <LegendList
                data={tracks}
                keyExtractor={keyExtractor}
                renderItem={renderTrack}
                style={{ flex: 1 }}
                contentContainerStyle={
                    tracks.length
                        ? undefined
                        : {
                              flexGrow: 1,
                              justifyContent: "center",
                              alignItems: "flex-start",
                              paddingVertical: 16,
                              paddingHorizontal: 10,
                          }
                }
                waitForInitialLayout={false}
                estimatedItemSize={64}
                recycleItems
                ListEmptyComponent={
                    <View className="items-start justify-center py-4 px-2.5">
                        <Text className="text-sm text-white/60 text-left">No tracks found</Text>
                    </View>
                }
            />
        </View>
    );
}

interface LibraryTrackRowProps {
    track: TrackData;
    index: number;
    onClick: (index: number, event?: NativeMouseEvent) => void;
    onRightClick: (index: number, event: NativeMouseEvent) => void;
    onMouseDown: (index: number, event: NativeMouseEvent) => void;
    selectedIndices$: Observable<Set<number>>;
    buildDragData: (activeIndex: number) => MediaLibraryDragData;
    onNativeDragStart: () => void;
}

function LibraryTrackRow({
    track,
    index,
    onClick,
    onRightClick,
    onMouseDown,
    selectedIndices$,
    buildDragData,
    onNativeDragStart,
}: LibraryTrackRowProps) {
    const dragData = buildDragData(index);

    if (Platform.OS === "macos") {
        return (
            <TrackDragSource
                tracks={dragData.tracks as NativeDragTrack[]}
                onDragStart={onNativeDragStart}
                className="flex-1"
            >
                <TrackItem
                    track={track}
                    index={index}
                    onClick={onClick}
                    onRightClick={onRightClick}
                    onMouseDown={onMouseDown}
                    showIndex={false}
                    showAlbumArt={false}
                    selectedIndices$={selectedIndices$}
                />
            </TrackDragSource>
        );
    }

    return (
        <DraggableItem
            id={`library-track-${track.id}`}
            zoneId={MEDIA_LIBRARY_DRAG_ZONE_ID}
            data={() => dragData}
            className="flex-1"
        >
            <TrackItem
                track={track}
                index={index}
                onClick={onClick}
                onRightClick={onRightClick}
                onMouseDown={onMouseDown}
                showIndex={false}
                showAlbumArt={false}
                selectedIndices$={selectedIndices$}
            />
        </DraggableItem>
    );
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
