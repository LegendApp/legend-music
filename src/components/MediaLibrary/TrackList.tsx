import { LegendList } from "@legendapp/list";
import type { Observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import { Platform, Text, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";

import { Button } from "@/components/Button";
import { DraggableItem, MEDIA_LIBRARY_DRAG_ZONE_ID, type MediaLibraryDragData } from "@/components/dnd";
import { localPlayerState$ } from "@/components/LocalAudioPlayer";
import type { TrackData } from "@/components/TrackItem";
import { Table, TableCell, TableHeader, TableRow, type TableColumnSpec } from "@/components/Table";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { type ContextMenuItem, showContextMenu } from "@/native-modules/ContextMenu";
import { type NativeDragTrack, TrackDragSource } from "@/native-modules/TrackDragSource";
import type { QueueAction } from "@/utils/queueActions";
import { cn } from "@/utils/cn";
import { useLibraryTrackList } from "./useLibraryTrackList";

interface TrackListProps {
}

export function TrackList(_props: TrackListProps) {
    const {
        tracks,
        selectedIndices$,
        handleTrackClick,
        handleTrackDoubleClick,
        handleTrackContextMenu,
        handleTrackQueueAction,
        handleNativeDragStart,
        buildDragData,
        keyExtractor,
    } = useLibraryTrackList();

    const columns = useMemo<TableColumnSpec[]>(
        () => [
            { id: "number", label: "#", width: 36, align: "right" },
            { id: "title", label: "Title", flex: 3, minWidth: 120 },
            { id: "artist", label: "Artist", flex: 2, minWidth: 100 },
            { id: "album", label: "Album", flex: 2, minWidth: 100 },
            { id: "duration", label: "Duration", width: 64, align: "right" },
            { id: "actions", width: 28, align: "center" },
        ],
        [],
    );

    const renderTrack = useCallback(
        ({ item, index }: { item: TrackData; index: number }) => {
            if (item.isSeparator) {
                return <LibrarySeparatorRow title={item.title} />;
            }

            return (
                <LibraryTrackRow
                    track={item}
                    index={index}
                    columns={columns}
                    onClick={handleTrackClick}
                    onDoubleClick={handleTrackDoubleClick}
                    onRightClick={handleTrackContextMenu}
                    onMenuAction={handleTrackQueueAction}
                    selectedIndices$={selectedIndices$}
                    buildDragData={buildDragData}
                    onNativeDragStart={handleNativeDragStart}
                />
            );
        },
        [
            buildDragData,
            handleTrackClick,
            handleTrackDoubleClick,
            handleTrackContextMenu,
            handleTrackQueueAction,
            handleNativeDragStart,
            selectedIndices$,
            columns,
        ],
    );

    return (
        <View className="flex-1 min-h-0">
            <Table header={<TableHeader columns={columns} />}>
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
                    estimatedItemSize={36}
                    recycleItems
                    ListEmptyComponent={
                        <View className="items-start justify-center py-4 px-2.5">
                            <Text className="text-sm text-white/60 text-left">No tracks found</Text>
                        </View>
                    }
                />
            </Table>
        </View>
    );
}

function LibrarySeparatorRow({ title }: { title: string }) {
    return (
        <View className="flex-row items-center px-4 py-4 mt-6 mb-2">
            <View className="flex-1 h-px bg-white/15" />
            <Text className="text-white/90 text-xs font-semibold tracking-wider uppercase mx-4 bg-white/5 px-3 py-1.5 rounded-full border border-white/15">
                {title.replace(/^— (.+) —$/, "$1")}
            </Text>
            <View className="flex-1 h-px bg-white/15" />
        </View>
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
    selectedIndices$: Observable<Set<number>>;
    buildDragData: (activeIndex: number) => MediaLibraryDragData;
    onNativeDragStart: () => void;
}

const TRACK_ROW_MENU_ITEMS: ContextMenuItem[] = [
    { id: "play-now", title: "Play Now" },
    { id: "play-next", title: "Play Next" },
    { id: "star", title: "Star", enabled: false },
];

function LibraryTrackRow({
    track,
    index,
    columns,
    onClick,
    onDoubleClick,
    onRightClick,
    onMenuAction,
    selectedIndices$,
    buildDragData,
    onNativeDragStart,
}: LibraryTrackRowProps) {
    const dragData = buildDragData(index);
    const listItemStyles = useListItemStyles();
    const isSelected = useValue(() => selectedIndices$.get().has(index));
    const isPlaying = useValue(() => {
        const currentTrack = localPlayerState$.currentTrack.get();
        return currentTrack ? currentTrack.id === track.id : false;
    });
    const displayIndex = (track.index ?? index) + 1;

    const handleMenuClick = useCallback(
        async (event: NativeMouseEvent) => {
            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;

            const selection = await showContextMenu(TRACK_ROW_MENU_ITEMS, { x, y });
            if (!selection) {
                return;
            }

            if (selection === "play-now" || selection === "play-next") {
                onMenuAction(index, selection);
            }
        },
        [index, onMenuAction],
    );

    const row = (
        <TableRow
            className="w-full"
            isSelected={isSelected}
            isActive={isPlaying}
            onClick={(event) => onClick(index, event)}
            onDoubleClick={(event) => onDoubleClick(index, event)}
            onRightClick={(event) => onRightClick(index, event)}
        >
            <TableCell column={columns[0]}>
                <Text className={cn("text-xs tabular-nums", listItemStyles.text.muted)}>{displayIndex}</Text>
            </TableCell>
            <TableCell column={columns[1]}>
                <Text className={cn("text-sm font-medium truncate", listItemStyles.text.primary)} numberOfLines={1}>
                    {track.title}
                </Text>
            </TableCell>
            <TableCell column={columns[2]}>
                <Text className={cn("text-sm truncate", listItemStyles.text.secondary)} numberOfLines={1}>
                    {track.artist}
                </Text>
            </TableCell>
            <TableCell column={columns[3]}>
                <Text className={cn("text-sm truncate", listItemStyles.text.secondary)} numberOfLines={1}>
                    {track.album ?? ""}
                </Text>
            </TableCell>
            <TableCell column={columns[4]}>
                <Text className={listItemStyles.getMetaClassName({ className: "text-xs" })}>{track.duration}</Text>
            </TableCell>
            <TableCell column={columns[5]} className="pl-1 pr-1">
                <Button
                    icon="ellipsis"
                    variant="icon"
                    size="small"
                    accessibilityLabel="Track actions"
                    onClick={handleMenuClick}
                    className="bg-transparent hover:bg-white/10"
                />
            </TableCell>
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
