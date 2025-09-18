import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
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

    const toggleNode = useCallback(
        (nodeId: string) => {
            if (expandedNodes.includes(nodeId)) {
                libraryUI$.expandedNodes.set(expandedNodes.filter((id) => id !== nodeId));
            } else {
                libraryUI$.expandedNodes.set([...expandedNodes, nodeId]);
            }
        },
        [expandedNodes],
    );

    const selectItem = useCallback((item: any) => {
        libraryUI$.selectedItem.set(item);
    }, []);

    type TreeRow = {
        key: string;
        type: "heading" | "section" | "item" | "info";
        label: string;
        depth: number;
        sectionId?: "artists" | "playlists";
        isExpanded?: boolean;
        payload?: any;
        isSelected?: boolean;
    };

    const treeRows = useMemo<TreeRow[]>(() => {
        const rows: TreeRow[] = [];

        const artistsExpanded = expandedNodes.includes("artists");
        rows.push({
            key: "section-artists",
            type: "section",
            label: `Artists (${artists.length})`,
            depth: 0,
            sectionId: "artists",
            isExpanded: artistsExpanded,
        });

        if (artistsExpanded) {
            for (const artist of artists) {
                rows.push({
                    key: `artist-${artist.id}`,
                    type: "item",
                    label: artist.name,
                    depth: 1,
                    payload: artist,
                    isSelected: selectedItem?.id === artist.id,
                });
            }
        }

        const playlistsExpanded = expandedNodes.includes("playlists");
        rows.push({
            key: "section-playlists",
            type: "section",
            label: `Playlists (${playlists.length})`,
            depth: 0,
            sectionId: "playlists",
            isExpanded: playlistsExpanded,
        });

        if (playlistsExpanded) {
            for (const playlist of playlists) {
                rows.push({
                    key: `playlist-${playlist.id}`,
                    type: "item",
                    label: playlist.name,
                    depth: 1,
                    payload: playlist,
                    isSelected: selectedItem?.id === playlist.id,
                });
            }
        }

        return rows;
    }, [artists, expandedNodes, playlists, selectedItem]);

    const renderRow = useCallback(
        ({ item }: { item: TreeRow }) => {
            if (item.type === "heading") {
                return <Text style={styles.treeHeading}>{item.label}</Text>;
            }

            if (item.type === "section") {
                return (
                    <Button
                        icon={item.isExpanded ? "chevron.down" : "chevron.right"}
                        iconSize={10}
                        onPress={() => toggleNode(item.sectionId!)}
                        className={listItemStyles.getRowClassName({ variant: "compact" })}
                    >
                        <Text className={cn("text-sm", listItemStyles.text.primary)}>{item.label}</Text>
                    </Button>
                );
            }

            if (item.type === "info") {
                return <Text style={styles.treeInfo}>{item.label}</Text>;
            }

            const indentClass = item.depth > 0 ? "pl-4" : "";
            return (
                <Button
                    onPress={() => selectItem(item.payload)}
                    className={listItemStyles.getRowClassName({
                        isActive: Boolean(item.isSelected),
                        variant: "compact",
                        className: cn(indentClass),
                    })}
                >
                    <Text
                        className={cn(
                            "text-sm",
                            item.isSelected ? listItemStyles.text.primary : listItemStyles.text.secondary,
                        )}
                    >
                        {item.label}
                    </Text>
                </Button>
            );
        },
        [listItemStyles, selectItem, toggleNode],
    );

    return (
        <LegendList
            data={treeRows}
            keyExtractor={(item) => item.key}
            renderItem={renderRow}
            style={styles.treeScroll}
            contentContainerStyle={styles.treeContent}
            estimatedItemSize={44}
            waitForInitialLayout={false}
        />
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
    treeInfo: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 12,
        marginTop: 12,
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
