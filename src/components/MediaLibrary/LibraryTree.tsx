import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";

import { Button } from "@/components/Button";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { type ContextMenuItem, showContextMenu } from "@/native-modules/ContextMenu";
import type { LibraryItem, LibraryTrack } from "@/systems/LibraryState";
import { library$, libraryUI$ } from "@/systems/LibraryState";
import type { SFSymbols } from "@/types/SFSymbols";
import { cn } from "@/utils/cn";
import { perfCount } from "@/utils/perfLogger";
import { getTracksForLibraryItem } from "@/utils/trackResolution";

interface LibraryTreeProps {
    searchQuery: string;
}

const MEDIA_LIBRARY_CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
    { id: "queue-add", title: "Add to Queue" },
    { id: "queue-play-next", title: "Play Next" },
];

export function LibraryTree({ searchQuery }: LibraryTreeProps) {
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

        const allowedTypes = collectionTypeMap[selectedCollection] ?? [];
        if (!selectedItem || !allowedTypes.includes(selectedItem.type)) {
            if (collectionItems.length > 0) {
                libraryUI$.selectedItem.set(collectionItems[0]);
            } else {
                libraryUI$.selectedItem.set(null);
            }
        }
    }, [collectionItems, selectedCollection, selectedItem]);

    const changeCollection = useCallback((collection: "artists" | "albums" | "playlists") => {
        libraryUI$.selectedCollection.set(collection);
    }, []);

    const collectionTabs = useMemo(
        () =>
            [
                { id: "artists", label: "Artists", icon: "person.crop.square" as SFSymbols },
                { id: "albums", label: "Albums", icon: "rectangle.stack.person.crop" as SFSymbols },
                { id: "playlists", label: "Playlists", icon: "music.note.list" as SFSymbols },
            ] as const,
        [],
    );

    return (
        <View className="flex-1">
            <View className="flex-row gap-1 px-1 pb-2">
                {collectionTabs.map((tab) => (
                    <Button
                        key={tab.id}
                        variant="ghost"
                        size="small"
                        icon={tab.icon}
                        iconSize={14}
                        className={cn(
                            "flex-1 h-7",
                            selectedCollection === tab.id ? "bg-white/15 text-white" : "bg-transparent text-white/70",
                        )}
                        onClick={() => changeCollection(tab.id)}
                    >
                        <Text className="text-xs font-medium">{tab.label}</Text>
                    </Button>
                ))}
            </View>

            <LegendList
                data={collectionItems}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
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
                }}
                style={{ flex: 1 }}
                contentContainerStyle={{ alignItems: "stretch" }}
                estimatedItemSize={44}
                waitForInitialLayout={false}
                ListEmptyComponent={
                    <View className="py-4 px-2">
                        <Text className="mt-3 text-xs text-white/40">No items found</Text>
                    </View>
                }
            />
        </View>
    );
}
