import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import { Panel, PanelGroup, ResizeHandle } from "@/components/ResizablePanels";
import { type TrackData, TrackItem } from "@/components/TrackItem";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import type { LibraryTrack } from "@/systems/LibraryState";
import { library$, libraryUI$ } from "@/systems/LibraryState";
import { cn } from "@/utils/cn";
import { perfCount, perfLog } from "@/utils/perfLogger";

export function MediaLibraryView() {
    perfCount("MediaLibraryView.render");
    return (
        <View className="flex-1 bg-black/5 border-l border-white/10" style={styles.window}>
            <PanelGroup direction="horizontal">
                <Panel
                    id="sidebar"
                    minSize={80}
                    maxSize={300}
                    defaultSize={200}
                    order={0}
                    className="border-r border-white/10"
                >
                    <LibraryTree />
                </Panel>

                <ResizeHandle panelId="sidebar" />

                <Panel id="tracklist" minSize={80} defaultSize={200} order={1} flex>
                    <TrackList />
                </Panel>
            </PanelGroup>
        </View>
    );
}

function LibraryTree() {
    perfCount("MediaLibrary.LibraryTree.render");
    const selectedItem = use$(libraryUI$.selectedItem);
    const expandedNodes = use$(libraryUI$.expandedNodes);
    const artists = use$(library$.artists);
    const playlists = use$(library$.playlists);
    const listItemStyles = useListItemStyles();

    const toggleNode = (nodeId: string) => {
        const current = expandedNodes;
        if (current.includes(nodeId)) {
            libraryUI$.expandedNodes.set(current.filter((id) => id !== nodeId));
        } else {
            libraryUI$.expandedNodes.set([...current, nodeId]);
        }
    };

    const selectItem = (item: any) => {
        libraryUI$.selectedItem.set(item);
    };

    return (
        <ScrollView
            style={styles.treeScroll}
            contentContainerStyle={styles.treeContent}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={styles.treeHeading}>Browse</Text>

            {/* Artists */}
            <Button
                icon={expandedNodes.includes("artists") ? "chevron.down" : "chevron.right"}
                iconSize={10}
                onPress={() => toggleNode("artists")}
                className={cn("mb-1", listItemStyles.getRowClassName())}
            >
                <Text className={cn("text-sm ml-1", listItemStyles.text.primary)}>Artists ({artists.length})</Text>
            </Button>

            {/* Show artists when expanded */}
            {expandedNodes.includes("artists") && (
                <View style={styles.nestedList}>
                    {artists.map((artist) => (
                        <Button
                            key={artist.id}
                            onPress={() => selectItem(artist)}
                            className={listItemStyles.getRowClassName({
                                variant: "compact",
                                isActive: selectedItem?.id === artist.id,
                            })}
                        >
                            <Text
                                className={cn(
                                    "text-sm",
                                    selectedItem?.id === artist.id
                                        ? listItemStyles.text.primary
                                        : listItemStyles.text.secondary,
                                )}
                            >
                                {artist.name}
                            </Text>
                        </Button>
                    ))}
                </View>
            )}

            {/* All Songs */}
            <Button
                onPress={() => selectItem({ id: "all-songs", type: "all", name: "All Songs" })}
                className={cn("mb-1", listItemStyles.getRowClassName({ isActive: selectedItem?.id === "all-songs" }))}
            >
                <Text
                    className={cn(
                        "text-sm",
                        selectedItem?.id === "all-songs" ? listItemStyles.text.primary : listItemStyles.text.secondary,
                    )}
                >
                    All Songs
                </Text>
            </Button>

            {/* Playlists */}
            <Button
                icon={expandedNodes.includes("playlists") ? "chevron.down" : "chevron.right"}
                iconSize={10}
                onPress={() => toggleNode("playlists")}
                className={cn("mb-1", listItemStyles.getRowClassName())}
            >
                <Text className={cn("text-sm ml-1", listItemStyles.text.primary)}>Playlists ({playlists.length})</Text>
            </Button>

            {/* Show playlists when expanded */}
            {expandedNodes.includes("playlists") && (
                <View style={styles.nestedList}>
                    {playlists.map((playlist) => (
                        <Button
                            key={playlist.id}
                            onPress={() => selectItem(playlist)}
                            className={cn(
                                "mb-1 pl-4",
                                listItemStyles.getRowClassName({
                                    isActive: selectedItem?.id === playlist.id,
                                }),
                            )}
                        >
                            <Text
                                className={cn(
                                    "text-sm",
                                    selectedItem?.id === playlist.id
                                        ? listItemStyles.text.primary
                                        : listItemStyles.text.secondary,
                                )}
                            >
                                {playlist.name}
                            </Text>
                        </Button>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

function TrackList() {
    perfCount("MediaLibrary.TrackList.render");
    const selectedItem = use$(libraryUI$.selectedItem);
    const allTracks = use$(library$.tracks);

    const tracks = useMemo((): TrackData[] => {
        perfLog("MediaLibrary.TrackList.useMemo", {
            selectedItem,
            allTracks: allTracks.length,
        });
        if (!selectedItem) {
            return [];
        }

        let filteredTracks: LibraryTrack[];
        if (selectedItem.type === "artist") {
            filteredTracks = allTracks.filter((track) => track.artist === selectedItem.name);
        } else if (selectedItem.type === "playlist") {
            // For now, show all tracks for playlist items
            filteredTracks = allTracks;
        } else {
            filteredTracks = allTracks;
        }

        return filteredTracks.map((track) => ({
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: formatDuration(track.duration),
            thumbnail: track.thumbnail,
        }));
    }, [allTracks, selectedItem]);

    const keyExtractor = useCallback((item: TrackData) => item.id, []);

    const handleTrackPress = useCallback(
        (index: number) => {
            // Convert TrackData back to LibraryTrack format for loadPlaylist
            const originalTracks = allTracks.filter((track) => {
                if (!selectedItem) return false;
                if (selectedItem.type === "artist") {
                    return track.artist === selectedItem.name;
                }
                if (selectedItem.type === "playlist") {
                    return true;
                }
                return true;
            });
            localAudioControls.loadPlaylist(originalTracks, index);
        },
        [allTracks, selectedItem],
    );

    const renderTrack = useCallback(
        ({ item, index }: { item: TrackData; index: number }) => (
            <TrackItem
                track={item}
                index={index}
                onTrackClick={handleTrackPress}
                showIndex={false}
                showAlbumArt={false}
            />
        ),
        [handleTrackPress],
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
            <Text style={styles.trackListHeading}>
                {selectedItem.name} ({tracks.length} track{tracks.length !== 1 ? "s" : ""})
            </Text>

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
        return "0:00";
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
    treeScroll: {
        flex: 1,
    },
    treeContent: {
        alignItems: "stretch",
    },
    treeHeading: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 1,
        marginBottom: 8,
        textTransform: "uppercase",
    },
    nestedList: {
        marginBottom: 10,
        marginTop: 2,
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
    trackListContent: {
        paddingBottom: 16,
    },
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
});
