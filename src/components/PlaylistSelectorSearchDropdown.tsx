import { LegendList } from "@legendapp/list";
import { use$, useObservable } from "@legendapp/state/react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type GestureResponderEvent, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { DropdownMenu, type DropdownMenuRootRef } from "@/components/DropdownMenu";
import { TextInputSearch, type TextInputSearchRef } from "@/components/TextInputSearch";
import { TrackItem } from "@/components/TrackItem";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { cn } from "@/utils/cn";

interface PlaylistSelectorSearchDropdownProps {
    tracks: LocalTrack[];
    onSelectTrack: (track: LocalTrack, action: "enqueue" | "play-next") => void;
    onOpenChange?: (open: boolean) => void;
}

export const PlaylistSelectorSearchDropdown = forwardRef<DropdownMenuRootRef, PlaylistSelectorSearchDropdownProps>(
    function PlaylistSelectorSearchDropdown({ tracks, onSelectTrack, onOpenChange }, ref) {
        const searchQuery$ = useObservable("");
        const searchQuery = use$(searchQuery$);
        const isOpen$ = useObservable(false);
        const isOpen = use$(isOpen$);
        const [highlightedIndex, setHighlightedIndex] = useState(-1);
        const textInputRef = useRef<TextInputSearchRef>(null);
        const shiftPressedRef = useRef(false);

        const trimmedQuery = searchQuery.trim();

        const searchResults = useMemo(() => {
            if (!trimmedQuery) {
                return [] as LocalTrack[];
            }

            const lowerQuery = trimmedQuery.toLowerCase();

            return tracks
                .filter(
                    (track) =>
                        track.title.toLowerCase().includes(lowerQuery) ||
                        track.artist.toLowerCase().includes(lowerQuery),
                )
                .slice(0, 10);
        }, [tracks, trimmedQuery]);

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
                if (!open) {
                    searchQuery$.set("");
                    shiftPressedRef.current = false;
                }
                onOpenChange?.(open);
            },
            [onOpenChange, searchQuery$],
        );

        const getActionFromEvent = useCallback((event?: GestureResponderEvent): "enqueue" | "play-next" => {
            const nativeEvent = event?.nativeEvent as
                | (GestureResponderEvent["nativeEvent"] & { shiftKey?: boolean; modifierFlags?: number })
                | undefined;

            if (nativeEvent) {
                if (nativeEvent.shiftKey) {
                    return "play-next";
                }
                if (
                    typeof nativeEvent.modifierFlags === "number" &&
                    (nativeEvent.modifierFlags & KeyCodes.MODIFIER_SHIFT) === KeyCodes.MODIFIER_SHIFT
                ) {
                    return "play-next";
                }
            }

            return shiftPressedRef.current ? "play-next" : "enqueue";
        }, []);

        const handleTrackAction = useCallback(
            (track: LocalTrack, action: "enqueue" | "play-next") => {
                onSelectTrack(track, action);
                handleOpenChange(false);
            },
            [handleOpenChange, onSelectTrack],
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
                    handleTrackAction(searchResults[highlightedIndex], action);
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
        }, [handleTrackAction, highlightedIndex, isOpen, searchResults]);

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
                    <Button icon="magnifyingglass" variant="icon" size="small" className="ml-2 hover:bg-white/10" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                    directionalHint="topCenter"
                    setInitialFocus
                    variant="unstyled"
                    className="max-w-5xl"
                >
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
                                        keyExtractor={(track) => track.id}
                                        style={{ maxHeight: 256 }}
                                        renderItem={({ item: track, index }) => (
                                            <DropdownMenu.Item
                                                key={track.id}
                                                onSelect={(event) => {
                                                    const action = getActionFromEvent(event);
                                                    handleTrackAction(track, action);
                                                }}
                                                variant="unstyled"
                                                className={cn(
                                                    "hover:bg-white/10 rounded-md",
                                                    highlightedIndex === index && "bg-white/20",
                                                )}
                                            >
                                                <TrackItem
                                                    track={track}
                                                    index={index}
                                                    onTrackClick={(_, event) => {
                                                        const action = getActionFromEvent(event);
                                                        handleTrackAction(track, action);
                                                    }}
                                                />
                                            </DropdownMenu.Item>
                                        )}
                                    />
                                </View>
                            )}
                            {trimmedQuery && searchResults.length === 0 && (
                                <Text className="text-white/60 text-sm p-2">No tracks found</Text>
                            )}
                        </View>
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        );
    },
);
