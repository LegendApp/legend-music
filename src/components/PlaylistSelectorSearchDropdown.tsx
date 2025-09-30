import { LegendList } from "@legendapp/list";
import { use$, useObservable } from "@legendapp/state/react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type GestureResponderEvent, Text, useWindowDimensions, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";
import { Button } from "@/components/Button";
import { DropdownMenu, type DropdownMenuRootRef } from "@/components/DropdownMenu";
import { TextInputSearch, type TextInputSearchRef } from "@/components/TextInputSearch";
import { TrackItem } from "@/components/TrackItem";
import { playlistNavigationState$ } from "@/state/playlistNavigationState";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import type { LibraryItem } from "@/systems/LibraryState";
import { library$ } from "@/systems/LibraryState";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { cn } from "@/utils/cn";

interface PlaylistSelectorSearchDropdownProps {
    tracks: LocalTrack[];
    onSelectTrack: (track: LocalTrack, action: "enqueue" | "play-next") => void;
    onSelectLibraryItem?: (item: LibraryItem, action: "enqueue" | "play-next") => void;
    onOpenChange?: (open: boolean) => void;
}

export const PlaylistSelectorSearchDropdown = forwardRef<DropdownMenuRootRef, PlaylistSelectorSearchDropdownProps>(
    function PlaylistSelectorSearchDropdown({ tracks, onSelectTrack, onSelectLibraryItem, onOpenChange }, ref) {
        const searchQuery$ = useObservable("");
        const searchQuery = use$(searchQuery$);
        const isOpen$ = useObservable(false);
        const isOpen = use$(isOpen$);
        const [highlightedIndex, setHighlightedIndex] = useState(-1);
        const textInputRef = useRef<TextInputSearchRef>(null);
        const shiftPressedRef = useRef(false);
        const { width: windowWidth } = useWindowDimensions();

        const library = use$(library$);
        const trimmedQuery = searchQuery.trim();
        const effectiveWindowWidth = Math.max(windowWidth, 1);

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

        type SearchResult = { type: "track"; item: LocalTrack } | { type: "library"; item: LibraryItem };

        const searchResults = useMemo(() => {
            if (!trimmedQuery) {
                return [] as SearchResult[];
            }

            const lowerQuery = trimmedQuery.toLowerCase();
            const results: SearchResult[] = [];

            // Search tracks
            const matchingTracks = tracks
                .filter(
                    (track) =>
                        track.title.toLowerCase().includes(lowerQuery) ||
                        track.artist.toLowerCase().includes(lowerQuery) ||
                        track.album?.toLowerCase().includes(lowerQuery),
                )
                .slice(0, 6)
                .map((track): SearchResult => ({ type: "track", item: track }));

            // Search albums
            const matchingAlbums = library.albums
                .filter((album) => album.name.toLowerCase().includes(lowerQuery))
                .slice(0, 3)
                .map((album): SearchResult => ({ type: "library", item: album }));

            // Search artists
            const matchingArtists = library.artists
                .filter((artist) => artist.name.toLowerCase().includes(lowerQuery))
                .slice(0, 3)
                .map((artist): SearchResult => ({ type: "library", item: artist }));

            // Combine results: albums first, then artists, then tracks
            results.push(...matchingAlbums);
            results.push(...matchingArtists);
            results.push(...matchingTracks);

            return results.slice(0, 20);
        }, [tracks, library.albums, library.artists, trimmedQuery]);

        useEffect(() => {
            if (!isOpen) {
                setHighlightedIndex(-1);
                return;
            }

            if (searchResults.length === 0) {
                setHighlightedIndex(-1);
                return;
            }

            setHighlightedIndex((prev) => {
                if (prev < 0 || prev >= searchResults.length) {
                    return 0;
                }
                return prev;
            });
        }, [isOpen, searchResults]);

        const handleOpenChange = useCallback(
            (open: boolean) => {
                isOpen$.set(open);
                // Update global state to disable queue navigation when search is open
                playlistNavigationState$.isSearchDropdownOpen.set(open);
                if (!open) {
                    searchQuery$.set("");
                    shiftPressedRef.current = false;
                }
                onOpenChange?.(open);
            },
            [onOpenChange, searchQuery$],
        );

        const getActionFromEvent = useCallback(
            (event?: NativeMouseEvent | GestureResponderEvent): "enqueue" | "play-next" => {
                if (event) {
                    // Check if it's a NativeMouseEvent (direct from Button)
                    if ("shiftKey" in event && event.shiftKey) {
                        return "play-next";
                    }
                    // Check if it's a GestureResponderEvent (from DropdownMenu)
                    if ("nativeEvent" in event) {
                        const nativeEvent = event.nativeEvent as any;
                        if (nativeEvent?.shiftKey) {
                            return "play-next";
                        }
                    }
                }

                return shiftPressedRef.current ? "play-next" : "enqueue";
            },
            [],
        );

        const handleSearchResultAction = useCallback(
            (result: SearchResult, action: "enqueue" | "play-next") => {
                if (result.type === "track") {
                    onSelectTrack(result.item, action);
                } else if (result.type === "library") {
                    onSelectLibraryItem?.(result.item, action);
                }
                handleOpenChange(false);
            },
            [handleOpenChange, onSelectTrack, onSelectLibraryItem],
        );

        useEffect(() => {
            const removeKeyDown = KeyboardManager.addKeyDownListener((event) => {
                if (KeyboardManager.hasModifier(event, KeyCodes.MODIFIER_SHIFT)) {
                    shiftPressedRef.current = true;
                }

                if (!isOpen || searchResults.length === 0) {
                    return false;
                }

                if (event.keyCode === KeyCodes.KEY_DOWN) {
                    setHighlightedIndex((prev) => {
                        if (prev < 0) {
                            return 0;
                        }
                        return (prev + 1) % searchResults.length;
                    });
                    return true;
                }

                if (event.keyCode === KeyCodes.KEY_UP) {
                    setHighlightedIndex((prev) => {
                        if (prev < 0) {
                            return searchResults.length - 1;
                        }
                        return (prev - 1 + searchResults.length) % searchResults.length;
                    });
                    return true;
                }

                if (
                    event.keyCode === KeyCodes.KEY_RETURN &&
                    highlightedIndex >= 0 &&
                    highlightedIndex < searchResults.length
                ) {
                    const action = KeyboardManager.hasModifier(event, KeyCodes.MODIFIER_SHIFT)
                        ? "play-next"
                        : "enqueue";
                    handleSearchResultAction(searchResults[highlightedIndex], action);
                    return true;
                }

                return false;
            });

            const removeKeyUp = KeyboardManager.addKeyUpListener((event) => {
                if (!KeyboardManager.hasModifier(event, KeyCodes.MODIFIER_SHIFT)) {
                    shiftPressedRef.current = false;
                }
                return false;
            });

            return () => {
                removeKeyDown();
                removeKeyUp();
            };
        }, [handleSearchResultAction, highlightedIndex, isOpen, searchResults]);

        useEffect(() => {
            if (isOpen) {
                setTimeout(() => {
                    textInputRef.current?.focus();
                }, 0);
            }
        }, [isOpen]);

        return (
            <DropdownMenu.Root ref={ref} isOpen$={isOpen$} onOpenChange={handleOpenChange}>
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
                        {trimmedQuery && (
                            <View>
                                {searchResults.length > 0 && (
                                    <View style={{ maxHeight: 256 }}>
                                        <LegendList
                                            data={searchResults}
                                            keyExtractor={(result) =>
                                                result.type === "track" ? result.item.id : result.item.id
                                            }
                                            style={{ maxHeight: 256 }}
                                            extraData={{ highlightedIndex }}
                                            renderItem={({ item: result, index }) => {
                                                const key = result.type === "track" ? result.item.id : result.item.id;
                                                return (
                                                    <DropdownMenu.Item
                                                        key={key}
                                                        onSelect={(event) => {
                                                            const action = getActionFromEvent(event);
                                                            handleSearchResultAction(result, action);
                                                        }}
                                                        variant="unstyled"
                                                        className={cn(
                                                            "hover:bg-white/10 rounded-md",
                                                            highlightedIndex === index && "bg-white/20",
                                                        )}
                                                    >
                                                        {result.type === "track" ? (
                                                            <TrackItem
                                                                track={result.item}
                                                                index={index}
                                                                onClick={(_, event) => {
                                                                    const action = getActionFromEvent(event);
                                                                    handleSearchResultAction(result, action);
                                                                }}
                                                            />
                                                        ) : (
                                                            <View className="flex-row items-center px-3 py-2">
                                                                <View className="mr-3 w-8 h-8 bg-white/10 rounded flex-row items-center justify-center">
                                                                    <Text className="text-white/70 text-xs font-medium">
                                                                        {result.item.type === "album" ? "♪" : "👤"}
                                                                    </Text>
                                                                </View>
                                                                <View className="flex-1">
                                                                    <Text className="text-white text-sm font-medium">
                                                                        {result.item.name}
                                                                    </Text>
                                                                    <Text className="text-white/60 text-xs">
                                                                        {result.item.type === "album"
                                                                            ? `Album • ${result.item.trackCount} tracks`
                                                                            : `Artist • ${result.item.trackCount} tracks`}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        )}
                                                    </DropdownMenu.Item>
                                                );
                                            }}
                                        />
                                    </View>
                                )}
                                {trimmedQuery && searchResults.length === 0 && (
                                    <Text className="text-white/60 text-sm p-2">No results found</Text>
                                )}
                            </View>
                        )}
                    </View>
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        );
    },
);
