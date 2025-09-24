import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { Button } from "@/components/Button";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import { Panel, PanelGroup, ResizeHandle } from "@/components/ResizablePanels";
import { type TrackData, TrackItem } from "@/components/TrackItem";
import { TextInputSearch } from "@/components/TextInputSearch";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { Icon } from "@/systems/Icon";
import type { LibraryItem, LibraryTrack } from "@/systems/LibraryState";
import { library$, libraryUI$ } from "@/systems/LibraryState";
import type { SFSymbols } from "@/types/SFSymbols";
import { cn } from "@/utils/cn";
import { perfCount, perfLog } from "@/utils/perfLogger";

export function MediaLibraryView() {
    perfCount("MediaLibraryView.render");
    const searchQuery = use$(libraryUI$.searchQuery);
    return (
        <View className="flex-1 bg-black/5 border-l border-white/10" style={styles.window}>
            <View style={styles.searchContainer}>
                <TextInputSearch
                    value$={libraryUI$.searchQuery}
                    placeholder="Search library"
                    style={styles.searchInput}
                />
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
            <View style={styles.statusBar}>
                <Text style={styles.statusText}>Shift click to play next</Text>
            </View>
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

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const collectionItems = useMemo(() => {
        let items: LibraryItem[];
        switch (selectedCollection) {
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

        return items.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
    }, [albums, allSongsItem, artists, normalizedQuery, playlists, selectedCollection]);

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

    const handleCollectionChange = useCallback((collection: "artists" | "albums" | "playlists") => {
        libraryUI$.selectedCollection.set(collection);
    }, []);

    const renderRow = useCallback(
        ({ item }: { item: LibraryItem }) => {
            const isSelected = selectedItem?.id === item.id;
            return (
                <Button
                    onPress={() => selectItem(item)}
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
        [listItemStyles, selectItem, selectedItem?.id],
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
        <View style={styles.treeContainer}>
            <View className="mb-1 flex-row gap-1.5">
                {collectionTabs.map((tab) => (
                    <Button
                        key={tab.id}
                        onPress={() => handleCollectionChange(tab.id)}
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
                style={styles.treeScroll}
                contentContainerStyle={styles.treeContent}
                estimatedItemSize={44}
                waitForInitialLayout={false}
                ListEmptyComponent={
                    <View style={styles.treeEmptyState}>
                        <Text style={styles.treeInfo}>No {emptyLabel} found</Text>
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
                return title.includes(normalizedQuery) || artist.includes(normalizedQuery) || album.includes(normalizedQuery);
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

    const getActionFromEvent = useCallback((event?: GestureResponderEvent): "enqueue" | "play-next" => {
        return event?.nativeEvent?.shiftKey ? "play-next" : "enqueue";
    }, []);

    const handleTrackClick = useCallback(
        (index: number, event?: GestureResponderEvent) => {
            const action = getActionFromEvent(event);
            handleTrackAction(index, action);
        },
        [getActionFromEvent, handleTrackAction],
    );

    const renderTrack = useCallback(
        ({ item, index }: { item: TrackData; index: number }) => (
            <TrackItem
                track={item}
                index={index}
                onTrackClick={handleTrackClick}
                showIndex={false}
                showAlbumArt={false}
            />
        ),
        [handleTrackClick],
    );

    if (!selectedItem) {
        return (
            <View style={[styles.trackListContainer, styles.trackListPlaceholder]}>
                <Text style={styles.placeholderText}>Select an item to view tracks</Text>
            </View>
        );
    }

    return (
        <View style={styles.trackListContainer}>
            <LegendList
                data={tracks}
                keyExtractor={keyExtractor}
                renderItem={renderTrack}
                style={styles.trackList}
                contentContainerStyle={tracks.length ? styles.trackListContent : styles.trackListEmpty}
                waitForInitialLayout={false}
                estimatedItemSize={64}
                recycleItems
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.placeholderText}>No tracks found</Text>
                    </View>
                }
            />
        </View>
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

const styles = StyleSheet.create({
    window: {
        flex: 1,
        minWidth: 360,
        minHeight: 0,
    },
    contentRow: {
        display: "flex",
        flexDirection: "row",
        flex: 1,
        minHeight: 0,
    },
    treeColumn: {
        minWidth: 220,
        maxWidth: 300,
        minHeight: 0,
    },
    trackColumn: {
        flex: 1,
        minHeight: 0,
    },
    treeContainer: {
        flex: 1,
    },
    treeScroll: {
        flex: 1,
    },
    treeContent: {
        alignItems: "stretch",
    },
    treeInfo: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 12,
        marginTop: 12,
    },
    treeEmptyState: {
        paddingVertical: 16,
        paddingHorizontal: 8,
    },
    trackListContainer: {
        flex: 1,
        minHeight: 0,
    },
    trackListHeading: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 12,
    },
    trackList: {
        flex: 1,
    },
    trackListContent: {},
    trackListEmpty: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "flex-start",
        paddingVertical: 16,
        paddingHorizontal: 10,
    },
    emptyState: {
        alignItems: "flex-start",
        justifyContent: "center",
        paddingVertical: 16,
        paddingHorizontal: 10,
    },
    trackListPlaceholder: {
        justifyContent: "center",
        alignItems: "flex-start",
        paddingHorizontal: 10,
    },
    placeholderText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 14,
        textAlign: "left",
    },
    searchContainer: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
    },
    searchInput: {
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.1)",
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    statusBar: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(255,255,255,0.15)",
        backgroundColor: "rgba(0,0,0,0.2)",
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    statusText: {
        fontSize: 12,
        color: "rgba(255,255,255,0.55)",
    },
});
