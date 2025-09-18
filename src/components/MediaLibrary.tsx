import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo } from "react";
import type { ListRenderItemInfo } from "react-native";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Button } from "@/components/Button";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import type { LibraryTrack } from "@/systems/LibraryState";
import { library$, libraryUI$ } from "@/systems/LibraryState";

const LIBRARY_HEIGHT = 320;

export function MediaLibrary() {
    const isOpen = use$(libraryUI$.isOpen);
    const libraryHeight = useSharedValue(isOpen ? LIBRARY_HEIGHT : 0);

    const animatedStyle = useAnimatedStyle(() => ({
        height: libraryHeight.value,
        overflow: "hidden",
    }));

    const toggleLibrary = () => {
        const newIsOpen = !isOpen;
        libraryUI$.isOpen.set(newIsOpen);
        libraryHeight.value = withTiming(newIsOpen ? LIBRARY_HEIGHT : 0, { duration: 250 });
    };

    // Keyboard shortcut support
    useOnHotkeys({
        ToggleLibrary: toggleLibrary,
    });

    // Sync animation with state on mount
    useEffect(() => {
        libraryHeight.value = isOpen ? LIBRARY_HEIGHT : 0;
    }, [isOpen, libraryHeight]);

    return (
        <View>
            {/* Library Toggle Button */}
            <View className="px-3 py-2 border-t border-white/10">
                <Button
                    icon={isOpen ? "chevron.down" : "chevron.up"}
                    iconSize={14}
                    variant="icon-text"
                    size="small"
                    onPress={toggleLibrary}
                    className="flex-row items-center justify-center hover:bg-white/10 active:bg-white/15 rounded py-2"
                >
                    <Text className="text-white/80 text-sm ml-1">{isOpen ? "Hide Library" : "Show Library"}</Text>
                </Button>
            </View>

            {/* Library Content */}
            <Animated.View style={animatedStyle}>
                <View className="border-t border-white/10 bg-black/10" style={styles.panel}>
                    {/* Library Header */}
                    <View className="flex-row items-center justify-between px-3 py-2 bg-white/5">
                        <Text className="text-white text-sm font-medium">Library</Text>
                        <Button
                            icon="xmark"
                            iconSize={12}
                            variant="icon"
                            size="small"
                            onPress={() => {
                                libraryUI$.isOpen.set(false);
                                libraryHeight.value = withTiming(0, { duration: 250 });
                            }}
                            className="hover:bg-white/15 active:bg-white/25 rounded p-1"
                        />
                    </View>

                    {/* Library Content - Horizontal Split */}
                    <View className="flex-row flex-1" style={styles.contentRow}>
                        {/* Library Tree (Left) */}
                        <View className="border-r border-white/10 bg-black/5" style={styles.treeColumn}>
                            <LibraryTree />
                        </View>

                        {/* Track List (Right) */}
                        <View className="bg-black/5" style={styles.trackColumn}>
                            <TrackList />
                        </View>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}

function LibraryTree() {
    const selectedItem = use$(libraryUI$.selectedItem);
    const expandedNodes = use$(libraryUI$.expandedNodes);
    const artists = use$(library$.artists);
    const playlists = use$(library$.playlists);

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
                variant="icon-text"
                size="small"
                onPress={() => toggleNode("artists")}
                className="flex-row items-center mb-1 hover:bg-white/10 active:bg-white/15 rounded px-2 py-1"
            >
                <Text className="text-white/80 text-sm ml-1">Artists ({artists.length})</Text>
            </Button>

            {/* Show artists when expanded */}
            {expandedNodes.includes("artists") && (
                <View style={styles.nestedList}>
                    {artists.map((artist) => (
                        <Button
                            key={artist.id}
                            variant="text"
                            size="small"
                            onPress={() => selectItem(artist)}
                            className={`flex-row items-center mb-1 rounded px-2 py-1 ${
                                selectedItem?.id === artist.id
                                    ? "bg-blue-500/20 border-blue-400/30"
                                    : "hover:bg-white/10 active:bg-white/15"
                            }`}
                        >
                            <Text className="text-white/70 text-xs">{artist.name}</Text>
                        </Button>
                    ))}
                </View>
            )}

            {/* All Songs */}
            <Button
                variant="text"
                size="small"
                onPress={() => selectItem({ id: "all-songs", type: "all", name: "All Songs" })}
                className={`flex-row items-center mb-1 rounded px-2 py-1 ${
                    selectedItem?.id === "all-songs"
                        ? "bg-blue-500/20 border-blue-400/30"
                        : "hover:bg-white/10 active:bg-white/15"
                }`}
            >
                <Text className="text-white/80 text-sm">All Songs</Text>
            </Button>

            {/* Playlists */}
            <Button
                icon={expandedNodes.includes("playlists") ? "chevron.down" : "chevron.right"}
                iconSize={10}
                variant="icon-text"
                size="small"
                onPress={() => toggleNode("playlists")}
                className="flex-row items-center mb-1 hover:bg-white/10 active:bg-white/15 rounded px-2 py-1"
            >
                <Text className="text-white/80 text-sm ml-1">Playlists ({playlists.length})</Text>
            </Button>

            {/* Show playlists when expanded */}
            {expandedNodes.includes("playlists") && (
                <View style={styles.nestedList}>
                    {playlists.map((playlist) => (
                        <Button
                            key={playlist.id}
                            variant="text"
                            size="small"
                            onPress={() => selectItem(playlist)}
                            className={`flex-row items-center mb-1 rounded px-2 py-1 ${
                                selectedItem?.id === playlist.id
                                    ? "bg-blue-500/20 border-blue-400/30"
                                    : "hover:bg-white/10 active:bg-white/15"
                            }`}
                        >
                            <Text className="text-white/70 text-xs">{playlist.name}</Text>
                        </Button>
                    ))}
                </View>
            )}

            {/* Search */}
            <View className="mt-4">
                <Text className="text-white/40 text-xs">🔍 Search coming soon...</Text>
            </View>
        </ScrollView>
    );
}

function TrackList() {
    const selectedItem = use$(libraryUI$.selectedItem);
    const allTracks = use$(library$.tracks);

    const tracks = useMemo(() => {
        if (!selectedItem) {
            return [];
        }

        if (selectedItem.type === "artist") {
            return allTracks.filter((track) => track.artist === selectedItem.name);
        }

        if (selectedItem.type === "playlist") {
            // For now, show all tracks for playlist items
            return allTracks;
        }

        return allTracks;
    }, [allTracks, selectedItem]);

    const keyExtractor = useCallback((item: LibraryTrack) => item.id, []);

    const renderTrack = useCallback(
        ({ item }: ListRenderItemInfo<LibraryTrack>) => (
            <View className="flex-row items-center rounded-lg bg-white/5 px-2 py-2 hover:bg-white/10">
                <View className="flex-1">
                    <Text className="text-white/80 text-sm font-medium" numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text className="text-white/50 text-xs" numberOfLines={1}>
                        {item.album ? `${item.artist} • ${item.album}` : item.artist}
                    </Text>
                </View>
                <Text style={styles.trackDuration}>{formatDuration(item.duration)}</Text>
                <Button
                    icon="plus"
                    iconSize={12}
                    variant="icon"
                    size="small"
                    onPress={() => {
                        console.log("Add track to queue:", item.title);
                        // TODO: Add to actual queue
                    }}
                    className="hover:bg-white/15 active:bg-white/25 rounded p-1"
                />
            </View>
        ),
        [],
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

            <FlatList
                data={tracks}
                keyExtractor={keyExtractor}
                renderItem={renderTrack}
                ItemSeparatorComponent={Separator}
                style={styles.trackList}
                contentContainerStyle={tracks.length ? styles.trackListContent : styles.trackListEmpty}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.placeholderText}>No tracks found</Text>
                    </View>
                }
            />
        </View>
    );
}

function Separator() {
    return <View style={styles.separator} />;
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
    panel: {
        flex: 1,
    },
    contentRow: {
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
        paddingHorizontal: 12,
        paddingVertical: 12,
        paddingBottom: 24,
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
        marginLeft: 12,
        marginBottom: 12,
        marginTop: 4,
    },
    trackListContainer: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 12,
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
        paddingBottom: 24,
    },
    trackListEmpty: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 24,
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 24,
    },
    trackDuration: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 12,
        marginRight: 8,
        fontVariant: ["tabular-nums"],
    },
    separator: {
        height: 8,
    },
    trackListPlaceholder: {
        justifyContent: "center",
        alignItems: "center",
    },
    placeholderText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 14,
    },
});
