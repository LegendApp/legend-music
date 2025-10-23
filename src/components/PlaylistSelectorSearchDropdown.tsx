import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { forwardRef, useCallback, useEffect, useMemo, useRef } from "react";
import { type GestureResponderEvent, Text, useWindowDimensions, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";

import { Button } from "@/components/Button";
import { DropdownMenu, type DropdownMenuRootRef } from "@/components/DropdownMenu";
import { TextInputSearch, type TextInputSearchRef } from "@/components/TextInputSearch";
import { TrackItem } from "@/components/TrackItem";
import type { LibraryItem } from "@/systems/LibraryState";
import { library$ } from "@/systems/LibraryState";
import type { LocalPlaylist, LocalTrack } from "@/systems/LocalMusicState";
import { cn } from "@/utils/cn";
import { getQueueAction } from "@/utils/queueActions";

import {
    type SearchResult,
    useDropdownKeyboardNavigation,
    usePlaylistSearchResults,
    useSearchDropdownState,
} from "./PlaylistSelectorSearchDropdown/hooks";

interface PlaylistSelectorSearchDropdownProps {
    tracks: LocalTrack[];
    playlists: LocalPlaylist[];
    onSelectTrack: (track: LocalTrack, action: "enqueue" | "play-next") => void;
    onSelectLibraryItem?: (item: LibraryItem, action: "enqueue" | "play-next") => void;
    onSelectPlaylist?: (playlist: LocalPlaylist) => void;
    onOpenChange?: (open: boolean) => void;
}

export const PlaylistSelectorSearchDropdown = forwardRef<DropdownMenuRootRef, PlaylistSelectorSearchDropdownProps>(
    function PlaylistSelectorSearchDropdown(
        { tracks, playlists, onSelectTrack, onSelectLibraryItem, onSelectPlaylist, onOpenChange },
        ref,
    ) {
        const { searchQuery$, searchQuery, isOpen, isOpen$, handleOpenChange } = useSearchDropdownState(onOpenChange);
        const textInputRef = useRef<TextInputSearchRef>(null);
        const { width: windowWidth } = useWindowDimensions();

        const library = use$(library$);
        const effectiveWindowWidth = Math.max(windowWidth, 1);

        const searchResults = usePlaylistSearchResults({
            tracks,
            playlists,
            albums: library.albums,
            artists: library.artists,
            query: searchQuery,
        });

        const handleSearchResultAction = useCallback(
            (result: SearchResult, action: "enqueue" | "play-next") => {
                if (result.type === "track") {
                    onSelectTrack(result.item, action);
                } else if (result.type === "library") {
                    onSelectLibraryItem?.(result.item, action);
                } else if (result.type === "playlist") {
                    onSelectPlaylist?.(result.item);
                }
            },
            [onSelectLibraryItem, onSelectPlaylist, onSelectTrack],
        );

        const { highlightedIndex, shiftPressedRef } = useDropdownKeyboardNavigation({
            isOpen,
            resultsLength: searchResults.length,
            onSubmit: (index, action) => {
                const result = searchResults[index];
                if (result) {
                    handleSearchResultAction(result, action);
                    shiftPressedRef.current = false;
                    handleOpenChange(false);
                }
            },
        });

        useEffect(() => {
            if (isOpen) {
                setTimeout(() => {
                    textInputRef.current?.focus();
                }, 0);
            }
        }, [isOpen]);

        const anchorRect = useMemo(() => {
            const offsetTop = 16;
            const width = Math.max(effectiveWindowWidth, 1) - 16;

            return {
                screenX: 8,
                screenY: offsetTop,
                width,
                height: 0,
            };
        }, [effectiveWindowWidth]);

        const handleDropdownOpenChange = useCallback(
            (open: boolean) => {
                if (!open) {
                    shiftPressedRef.current = false;
                }
                handleOpenChange(open);
            },
            [handleOpenChange, shiftPressedRef],
        );

        const getActionFromEvent = useCallback(
            (event?: NativeMouseEvent | GestureResponderEvent): "enqueue" | "play-next" => {
                return getQueueAction({
                    event: event as unknown as { shiftKey?: boolean; nativeEvent?: { shiftKey?: boolean } },
                    shiftPressedFallback: shiftPressedRef.current,
                });
            },
            [shiftPressedRef],
        );

        return (
            <DropdownMenu.Root ref={ref} isOpen$={isOpen$} onOpenChange={handleDropdownOpenChange}>
                <DropdownMenu.Trigger asChild>
                    <Button
                        icon="magnifyingglass"
                        variant="icon"
                        size="small"
                        className="ml-2 hover:bg-white/10"
                        tooltip="Search playlists"
                    />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                    directionalHint="topCenter"
                    anchorRect={anchorRect}
                    minWidth={anchorRect.width}
                    maxWidth={anchorRect.width}
                    setInitialFocus
                    variant="unstyled"
                >
                    <View style={{ width: effectiveWindowWidth }}>
                        <View className="bg-background-tertiary border border-border-primary rounded-md px-3 py-1.5">
                            <TextInputSearch
                                ref={textInputRef}
                                value$={searchQuery$}
                                placeholder="Search tracks..."
                                className="text-sm text-text-primary"
                            />
                        </View>

                        {searchQuery.trim() ? (
                            <View>
                                {searchResults.length > 0 ? (
                                    <View style={{ maxHeight: 256 }}>
                                        <LegendList
                                            data={searchResults}
                                            keyExtractor={(result) => `${result.type}-${result.item.id}`}
                                            style={{ maxHeight: 256 }}
                                            extraData={{ highlightedIndex }}
                                            renderItem={({ item: result, index }) => (
                                                <DropdownMenu.Item
                                                    key={`${result.type}-${result.item.id}`}
                                                    variant="unstyled"
                                                    onSelect={(event) => {
                                                        const action = getActionFromEvent(event);
                                                        handleSearchResultAction(result, action);
                                                        shiftPressedRef.current = false;
                                                        handleOpenChange(false);
                                                    }}
                                                    className={cn(
                                                        "hover:bg-white/10 rounded-md",
                                                        highlightedIndex === index && "bg-white/20",
                                                    )}
                                                >
                                                    <SearchResultContent
                                                        result={result}
                                                        index={index}
                                                        highlighted={highlightedIndex === index}
                                                        onSelect={(action) => {
                                                            handleSearchResultAction(result, action);
                                                            shiftPressedRef.current = false;
                                                            handleOpenChange(false);
                                                        }}
                                                        getActionFromEvent={getActionFromEvent}
                                                    />
                                                </DropdownMenu.Item>
                                            )}
                                        />
                                    </View>
                                ) : (
                                    <Text className="text-white/60 text-sm p-2">No results found</Text>
                                )}
                            </View>
                        ) : null}
                    </View>
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        );
    },
);

interface SearchResultContentProps {
    result: SearchResult;
    index: number;
    highlighted: boolean;
    onSelect: (action: "enqueue" | "play-next") => void;
    getActionFromEvent: (event?: NativeMouseEvent | GestureResponderEvent) => "enqueue" | "play-next";
}

function SearchResultContent({ result, index, highlighted, onSelect, getActionFromEvent }: SearchResultContentProps) {
    const handleClick = useCallback(
        (event?: NativeMouseEvent) => {
            onSelect(getActionFromEvent(event));
        },
        [getActionFromEvent, onSelect],
    );

    const handleContextMenu = useCallback(
        (event: NativeMouseEvent) => {
            onSelect(getActionFromEvent(event));
        },
        [getActionFromEvent, onSelect],
    );

    if (result.type === "track") {
        return (
            <View className={cn("px-1", highlighted && "bg-white/10")}>
                <TrackItem
                    track={result.item}
                    index={index}
                    onClick={(_, event) => handleClick(event)}
                    onRightClick={handleContextMenu}
                />
            </View>
        );
    }

    const label = result.item.name;
    const subtitle = getSubtitle(result);

    return (
        <View className={cn("flex-row items-center px-3 py-2", highlighted ? "bg-white/10 rounded-md" : "rounded-md")}>
            <View className="mr-3 w-8 h-8 bg-white/10 rounded flex-row items-center justify-center">
                <Text className="text-white/70 text-xs font-medium">{getGlyph(result)}</Text>
            </View>
            <View className="flex-1">
                <Text className="text-white text-sm font-medium" numberOfLines={1}>
                    {label}
                </Text>
                {subtitle ? <Text className="text-white/60 text-xs">{subtitle}</Text> : null}
            </View>
        </View>
    );
}

function getGlyph(result: SearchResult) {
    if (result.type === "library") {
        return result.item.type === "album" ? "♪" : "👤";
    }
    return "PL";
}

function getSubtitle(result: SearchResult): string {
    if (result.type === "library") {
        const count = result.item.trackCount ?? 0;
        const label = result.item.type === "album" ? "Album" : "Artist";
        return count === 1 ? `${label} • 1 track` : `${label} • ${count} tracks`;
    }

    if (result.type === "playlist") {
        const count = result.item.trackCount ?? 0;
        return count === 1 ? "1 track" : `${count} tracks`;
    }

    return "";
}
