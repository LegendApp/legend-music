import { LegendList } from "@legendapp/list";
import { useValue } from "@legendapp/state/react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type GestureResponderEvent, Text, useWindowDimensions, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";
import { Button } from "@/components/Button";
import { DropdownMenu, type DropdownMenuRootRef } from "@/components/DropdownMenu";
import { SpotifySourceBadge } from "@/components/SpotifySourceBadge";
import { YoutubeMusicSourceBadge } from "@/components/YoutubeMusicSourceBadge";
import { TextInputSearch, type TextInputSearchRef } from "@/components/TextInputSearch";
import { TrackItem } from "@/components/TrackItem";
import { getProvider } from "@/providers/providerRegistry";
import { enabledSearchProviderIds$, getSearchProvider } from "@/providers/search/registry";
import type { SearchResult } from "@/providers/search/types";
import type { LibraryItem } from "@/systems/LibraryState";
import { library$ } from "@/systems/LibraryState";
import type { LocalPlaylist, LocalTrack } from "@/systems/LocalMusicState";
import { cn } from "@/utils/cn";
import { getQueueAction, type QueueAction } from "@/utils/queueActions";
import { useDropdownKeyboardNavigation, usePlaylistSearchResults, useSearchDropdownState } from "./JumpSearchMenuDropdown/hooks";

const formatProviderNames = (names: string[]): string => {
    if (names.length === 0) {
        return "providers";
    }
    if (names.length === 1) {
        return names[0];
    }
    if (names.length === 2) {
        return `${names[0]} and ${names[1]}`;
    }
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};
interface JumpSearchMenuDropdownProps {
    tracks: LocalTrack[];
    playlists: LocalPlaylist[];
    onSelectTrack: (track: LocalTrack, action: QueueAction) => void;
    onSelectLibraryItem?: (item: LibraryItem, action: QueueAction) => void;
    onSelectPlaylist?: (playlist: LocalPlaylist) => void;
    onOpenChange?: (open: boolean) => void;
    dropdownWidth?: number;
}

export const JumpSearchMenuDropdown = forwardRef<DropdownMenuRootRef, JumpSearchMenuDropdownProps>(
    function JumpSearchMenuDropdown(
        { tracks, playlists, onSelectTrack, onSelectLibraryItem, onSelectPlaylist, onOpenChange, dropdownWidth },
        ref,
    ) {
        const { searchQuery$, searchQuery, isOpen, isOpen$, handleOpenChange } = useSearchDropdownState(onOpenChange);
        const textInputRef = useRef<TextInputSearchRef>(null);
        const { width: windowWidth } = useWindowDimensions();

        const library = useValue(library$);
        const enabledSearchProviderIds = useValue(enabledSearchProviderIds$);
        const remoteSearchProviders = useMemo(() => {
            return enabledSearchProviderIds
                .filter((providerId) => providerId !== "local")
                .map((providerId) => {
                    const provider = getProvider(providerId);
                    const searchProvider = getSearchProvider(providerId);
                    if (!provider || !searchProvider) {
                        return null;
                    }
                    return { id: providerId, name: provider.name ?? "Provider", searchProvider };
                })
                .filter((provider): provider is NonNullable<typeof provider> => Boolean(provider));
        }, [enabledSearchProviderIds]);
        const remoteSearchProviderNames = useMemo(
            () => remoteSearchProviders.map((provider) => provider.name),
            [remoteSearchProviders],
        );
        const remoteSearchProviderLabel = useMemo(
            () => formatProviderNames(remoteSearchProviderNames),
            [remoteSearchProviderNames],
        );
        const isRemoteSearchEnabled = remoteSearchProviders.length > 0;
        const effectiveWindowWidth = Math.max(windowWidth, 1);
        const fallbackWidth = Math.max(effectiveWindowWidth - 16, 1);
        const resolvedDropdownWidth = Math.max(dropdownWidth ?? fallbackWidth, 1);

        const [providerResultsById, setProviderResultsById] = useState<Record<string, SearchResult[]>>({});
        const [providerSearchStatusById, setProviderSearchStatusById] = useState<
            Record<string, "idle" | "searching" | "success" | "error">
        >({});
        const providerSearchRequestIdRef = useRef(0);
        const providerSearchQueryRef = useRef("");

        const resetProviderSearch = useCallback(() => {
            providerSearchRequestIdRef.current += 1;
            providerSearchQueryRef.current = "";
            setProviderResultsById({});
            setProviderSearchStatusById({});
        }, []);

        useEffect(() => {
            resetProviderSearch();
        }, [resetProviderSearch, searchQuery]);

        useEffect(() => {
            if (!isRemoteSearchEnabled) {
                resetProviderSearch();
            }
        }, [isRemoteSearchEnabled, resetProviderSearch]);

        useEffect(() => {
            resetProviderSearch();
        }, [resetProviderSearch, remoteSearchProviders]);

        const localSearchResults = usePlaylistSearchResults({
            tracks,
            playlists,
            albums: library.albums,
            artists: library.artists,
            query: searchQuery,
        });

        const providerResults = useMemo(() => {
            if (!isRemoteSearchEnabled) {
                return [];
            }
            return remoteSearchProviders.flatMap((provider) => providerResultsById[provider.id] ?? []);
        }, [isRemoteSearchEnabled, providerResultsById, remoteSearchProviders]);

        const searchResults = useMemo(
            () => (isRemoteSearchEnabled ? [...localSearchResults, ...providerResults] : localSearchResults),
            [isRemoteSearchEnabled, localSearchResults, providerResults],
        );

        const providerStatuses = useMemo(() => Object.values(providerSearchStatusById), [providerSearchStatusById]);
        const isProviderSearching = providerStatuses.some((status) => status === "searching");
        const hasProviderError = providerStatuses.some((status) => status === "error");
        const handleProviderSearch = useCallback(async () => {
            if (!isRemoteSearchEnabled || remoteSearchProviders.length === 0) {
                return;
            }

            const trimmedQuery = searchQuery.trim();
            if (!trimmedQuery) {
                return;
            }

            if (isProviderSearching) {
                return;
            }

            if (providerSearchQueryRef.current === trimmedQuery && !hasProviderError) {
                return;
            }

            const requestId = (providerSearchRequestIdRef.current += 1);
            providerSearchQueryRef.current = trimmedQuery;
            const searchingState: Record<string, "searching"> = {};
            for (const provider of remoteSearchProviders) {
                searchingState[provider.id] = "searching";
            }
            setProviderResultsById({});
            setProviderSearchStatusById(searchingState);

            try {
                const nextResults: Record<string, SearchResult[]> = {};
                const nextStatuses: Record<string, "success" | "error"> = {};
                await Promise.all(
                    remoteSearchProviders.map(async ({ id, searchProvider }) => {
                        try {
                            const results = await searchProvider.search({ query: trimmedQuery });
                            nextResults[id] = results;
                            nextStatuses[id] = "success";
                        } catch (error) {
                            console.error("Provider search failed", { providerId: id, error });
                            nextResults[id] = [];
                            nextStatuses[id] = "error";
                        }
                    }),
                );
                if (providerSearchRequestIdRef.current !== requestId) {
                    return;
                }
                setProviderResultsById(nextResults);
                setProviderSearchStatusById(nextStatuses);
            } catch (error) {
                if (providerSearchRequestIdRef.current !== requestId) {
                    return;
                }
                console.error("Provider search failed", error);
                providerSearchQueryRef.current = "";
                setProviderResultsById({});
                setProviderSearchStatusById({});
            }
        }, [hasProviderError, isProviderSearching, isRemoteSearchEnabled, remoteSearchProviders, searchQuery]);

        const trimmedQuery = searchQuery.trim();
        const hasProviderQuery = trimmedQuery.length > 0;
        const hasSearchedProvider =
            providerSearchQueryRef.current === trimmedQuery &&
            providerStatuses.length > 0 &&
            !isProviderSearching &&
            !hasProviderError;
        const shouldShowProviderAction =
            isRemoteSearchEnabled && hasProviderQuery && !isProviderSearching && (!hasSearchedProvider || hasProviderError);
        const providerStatusText = useMemo(() => {
            if (!isRemoteSearchEnabled || !hasProviderQuery) {
                return null;
            }

            if (isProviderSearching) {
                return `Searching ${remoteSearchProviderLabel}...`;
            }

            if (hasProviderError) {
                const failedProviders = remoteSearchProviders
                    .filter((provider) => providerSearchStatusById[provider.id] === "error")
                    .map((provider) => provider.name);
                const failedLabel = formatProviderNames(failedProviders);
                return `${failedLabel} search failed. Press Cmd+Enter to retry.`;
            }

            if (hasSearchedProvider && providerResults.length === 0) {
                return `No ${remoteSearchProviderLabel} results.`;
            }

            if (!hasSearchedProvider) {
                return `Press Cmd+Enter to search ${remoteSearchProviderLabel}.`;
            }

            return null;
        }, [
            hasProviderQuery,
            hasSearchedProvider,
            hasProviderError,
            isProviderSearching,
            isRemoteSearchEnabled,
            providerResults.length,
            providerSearchStatusById,
            remoteSearchProviderLabel,
            remoteSearchProviders,
        ]);

        const handleSearchResultAction = useCallback(
            (result: SearchResult, action: QueueAction) => {
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

        const { highlightedIndex, modifierStateRef, resetModifiers } = useDropdownKeyboardNavigation({
            isOpen,
            resultsLength: searchResults.length,
            onEnter: (modifierState) => {
                if (!isRemoteSearchEnabled || !trimmedQuery || !modifierState.meta) {
                    return false;
                }
                void handleProviderSearch();
                return true;
            },
            onEscape: () => handleOpenChange(false),
            onSubmit: (index, action) => {
                const result = searchResults[index];
                if (result) {
                    handleSearchResultAction(result, action);
                    resetModifiers();
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

            return {
                screenX: 8,
                screenY: offsetTop,
                width: resolvedDropdownWidth,
                height: 0,
            };
        }, [resolvedDropdownWidth]);

        const handleDropdownOpenChange = useCallback(
            (open: boolean) => {
                if (!open) {
                    resetModifiers();
                }
                handleOpenChange(open);
            },
            [handleOpenChange, resetModifiers],
        );

        const getActionFromEvent = useCallback(
            (event?: NativeMouseEvent | GestureResponderEvent): QueueAction => {
                return getQueueAction({
                    event: event as unknown as {
                        shiftKey?: boolean;
                        altKey?: boolean;
                        ctrlKey?: boolean;
                        metaKey?: boolean;
                        nativeEvent?: {
                            shiftKey?: boolean;
                            altKey?: boolean;
                            ctrlKey?: boolean;
                            metaKey?: boolean;
                        };
                    },
                    modifierState: modifierStateRef.current,
                    fallbackAction: "play-now",
                });
            },
            [modifierStateRef],
        );

        const keyExtractor = useCallback((result: SearchResult) => `${result.type}-${result.item.id}`, []);

        const getFixedItemSize = useCallback(
            (_index: number, item: SearchResult) => (item.type === "track" ? 32 : 52),
            [],
        );

        const getItemType = useCallback((item: SearchResult) => item.type, []);

        const handleItemSelect = useCallback(
            (result: SearchResult, action: QueueAction) => {
                handleSearchResultAction(result, action);
                resetModifiers();
                handleOpenChange(false);
            },
            [handleOpenChange, handleSearchResultAction, resetModifiers],
        );

        const renderItem = useCallback(
            ({ item: result, index }: { item: SearchResult; index: number }) => {
                const isHighlighted = highlightedIndex === index;

                const handleDropdownSelect = (event?: NativeMouseEvent | GestureResponderEvent) => {
                    const action = getActionFromEvent(event);
                    handleItemSelect(result, action);
                };

                const handleContentSelect = (action: QueueAction) => {
                    handleItemSelect(result, action);
                };

                return (
                    <DropdownMenu.Item
                        key={`${result.type}-${result.item.id}`}
                        variant="unstyled"
                        onSelect={handleDropdownSelect}
                        className={cn(
                            "hover:bg-white/10 rounded-md w-full overflow-hidden",
                            isHighlighted && "bg-white/20",
                        )}
                    >
                        <SearchResultContent
                            result={result}
                            index={index}
                            highlighted={isHighlighted}
                            onSelect={handleContentSelect}
                            getActionFromEvent={getActionFromEvent}
                        />
                    </DropdownMenu.Item>
                );
            },
            [getActionFromEvent, handleItemSelect, highlightedIndex],
        );

        return (
            <DropdownMenu.Root ref={ref} isOpen$={isOpen$} onOpenChange={handleDropdownOpenChange} closeOnSelect={false}>
                <DropdownMenu.Trigger asChild>
                    <Button
                        icon="magnifyingglass"
                        variant="icon-hover"
                        size="xs"
                        iconYOffset={1}
                        iconSize={14}
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
                    <View style={{ width: resolvedDropdownWidth }}>
                        <View className="bg-background-tertiary border border-border-primary rounded-md px-3 py-1.5">
                            <TextInputSearch
                                ref={textInputRef}
                                value$={searchQuery$}
                                placeholder="Search tracks..."
                                className="text-sm text-text-primary"
                            />
                        </View>

                        {trimmedQuery ? (
                            <View>
                                {searchResults.length > 0 ? (
                                    <View style={{ maxHeight: 256 }}>
                                        <LegendList
                                            data={searchResults}
                                            keyExtractor={keyExtractor}
                                            style={{ maxHeight: 256 }}
                                            extraData={{ highlightedIndex }}
                                            getFixedItemSize={getFixedItemSize}
                                            getItemType={getItemType}
                                            renderItem={renderItem}
                                        />
                                    </View>
                                ) : (
                                    <Text className="text-white/60 text-sm p-2">No results found</Text>
                                )}
                                {shouldShowProviderAction ? (
                                    <DropdownMenu.Item
                                        variant="unstyled"
                                        onSelect={() => {
                                            void handleProviderSearch();
                                        }}
                                        className="mt-1 rounded-md hover:bg-white/10 w-full"
                                    >
                                        <View className="px-2 py-2">
                                            <Text className="text-white/80 text-sm">
                                                {`Search ${remoteSearchProviderLabel} for "${trimmedQuery}"`}
                                            </Text>
                                        </View>
                                    </DropdownMenu.Item>
                                ) : null}
                                {providerStatusText ? (
                                    <Text className="text-white/60 text-xs px-2 pb-2 pt-1">{providerStatusText}</Text>
                                ) : null}
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
    onSelect: (action: QueueAction) => void;
    getActionFromEvent: (event?: NativeMouseEvent | GestureResponderEvent) => QueueAction;
}

function SearchResultContent({ result, index, highlighted, onSelect, getActionFromEvent }: SearchResultContentProps) {
    const handleClick = useCallback(
        (event?: NativeMouseEvent) => {
            onSelect(getActionFromEvent(event));
        },
        [getActionFromEvent, onSelect],
    );

    const handleContextMenu = useCallback(
        (_index: number, event: NativeMouseEvent) => {
            onSelect(getActionFromEvent(event));
        },
        [getActionFromEvent, onSelect],
    );

    if (result.type === "track") {
        const providerId = result.item.provider;
        const rightAccessory =
            providerId === "spotify" ? (
                <SpotifySourceBadge size={12} />
            ) : providerId === "youtubeMusic" ? (
                <YoutubeMusicSourceBadge size={12} />
            ) : null;

        return (
            // <View className={cn(highlighted && "bg-white/10")}>
            <TrackItem
                track={result.item}
                index={index}
                onClick={(_, event) => handleClick(event)}
                onRightClick={handleContextMenu}
                showIndex={false}
                rightAccessory={rightAccessory}
            />
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
