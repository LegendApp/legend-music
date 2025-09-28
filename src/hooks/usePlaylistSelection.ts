import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useCallback, useEffect } from "react";
import type { NativeMouseEvent } from "react-native-macos";

import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import { state$ } from "@/systems/State";
import { playlistNavigationState$ } from "@/state/playlistNavigationState";

interface UsePlaylistSelectionOptions<T extends { isSeparator?: boolean }> {
    items: T[];
}

interface UsePlaylistSelectionResult {
    selectedIndices$: Observable<Set<number>>;
    handleTrackClick: (index: number, event?: NativeMouseEvent) => void;
}

export function usePlaylistSelection<T extends { isSeparator?: boolean }>(
    options: UsePlaylistSelectionOptions<T>,
): UsePlaylistSelectionResult {
    const { items } = options;
    const selectedIndices$ = useObservable<Set<number>>(new Set());
    const selectionAnchor$ = useObservable<number>(-1);
    const selectionFocus$ = useObservable<number>(-1);

    const updateSelectionState = useCallback(
        (nextSelection: Set<number>) => {
            selectedIndices$.set(nextSelection);
            playlistNavigationState$.hasSelection.set(nextSelection.size > 0);
        },
        [selectedIndices$],
    );

    const getPrimarySelectionIndex = useCallback(() => {
        const focusIndex = selectionFocus$.get();
        if (focusIndex !== -1) {
            return focusIndex;
        }
        const currentSelection = selectedIndices$.get();
        if (currentSelection.size === 0) {
            return -1;
        }
        return Math.min(...currentSelection);
    }, [selectedIndices$, selectionFocus$]);

    const handleTrackClick = useCallback(
        (index: number, event?: NativeMouseEvent) => {
            const track = items[index];

            if (track?.isSeparator) {
                return;
            }

            const isShiftPressed = event?.shiftKey;
            const isMultiToggle = event?.metaKey || event?.ctrlKey;
            const currentSelection = selectedIndices$.get();

            if (__DEV__) {
                console.log("Queue -> select index", index, {
                    shift: isShiftPressed,
                    meta: isMultiToggle,
                });
            }

            if (isShiftPressed) {
                const anchorIndex = selectionAnchor$.get();
                const start = anchorIndex !== -1 ? anchorIndex : index;
                const [minIndex, maxIndex] = start < index ? [start, index] : [index, start];
                const nextSelection = new Set<number>();
                for (let i = minIndex; i <= maxIndex; i += 1) {
                    nextSelection.add(i);
                }
                updateSelectionState(nextSelection);
                if (anchorIndex === -1) {
                    selectionAnchor$.set(index);
                }
                selectionFocus$.set(index);
                return;
            }

            if (isMultiToggle) {
                const nextSelection = new Set(currentSelection);
                if (nextSelection.has(index)) {
                    nextSelection.delete(index);
                    updateSelectionState(nextSelection);
                    if (nextSelection.size === 0) {
                        selectionAnchor$.set(-1);
                        selectionFocus$.set(-1);
                    } else if (selectionFocus$.get() === index) {
                        const nextFocus = Math.min(...nextSelection);
                        selectionFocus$.set(nextFocus);
                        if (!nextSelection.has(selectionAnchor$.get())) {
                            selectionAnchor$.set(nextFocus);
                        }
                    }
                } else {
                    nextSelection.add(index);
                    updateSelectionState(nextSelection);
                    selectionAnchor$.set(index);
                    selectionFocus$.set(index);
                }
                return;
            }

            const nextSelection = new Set<number>([index]);
            updateSelectionState(nextSelection);
            selectionAnchor$.set(index);
            selectionFocus$.set(index);
        },
        [items, selectedIndices$, selectionAnchor$, selectionFocus$, updateSelectionState],
    );

    useEffect(() => {
        const handleKeyDown = (event: { keyCode: number; modifiers: number }) => {
            if (
                items.length === 0 ||
                playlistNavigationState$.isSearchDropdownOpen.get() ||
                state$.isDropdownOpen.get()
            ) {
                return false;
            }

            switch (event.keyCode) {
                case KeyCodes.KEY_UP: {
                    const hasShift = KeyboardManager.hasModifier(event, KeyCodes.MODIFIER_SHIFT);
                    const currentFocus = selectionFocus$.get();
                    const currentSelection = selectedIndices$.get();
                    const currentIndex =
                        currentFocus !== -1
                            ? currentFocus
                            : currentSelection.size > 0
                              ? Math.min(...currentSelection)
                              : 0;
                    const newIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                    if (hasShift && selectionAnchor$.get() !== -1) {
                        const anchor = selectionAnchor$.get();
                        const [minIndex, maxIndex] = anchor < newIndex ? [anchor, newIndex] : [newIndex, anchor];
                        const rangeSelection = new Set<number>();
                        for (let i = minIndex; i <= maxIndex; i += 1) {
                            rangeSelection.add(i);
                        }
                        updateSelectionState(rangeSelection);
                        selectionFocus$.set(newIndex);
                    } else {
                        updateSelectionState(new Set([newIndex]));
                        selectionAnchor$.set(newIndex);
                        selectionFocus$.set(newIndex);
                    }
                    return true;
                }

                case KeyCodes.KEY_DOWN: {
                    const hasShift = KeyboardManager.hasModifier(event, KeyCodes.MODIFIER_SHIFT);
                    const currentFocus = selectionFocus$.get();
                    const currentSelection = selectedIndices$.get();
                    const currentIndex =
                        currentFocus !== -1
                            ? currentFocus
                            : currentSelection.size > 0
                              ? Math.max(...currentSelection)
                              : -1;
                    const nextIndex = currentIndex >= items.length - 1 || currentIndex === -1 ? 0 : currentIndex + 1;
                    if (hasShift && selectionAnchor$.get() !== -1) {
                        const anchor = selectionAnchor$.get();
                        const [minIndex, maxIndex] = anchor < nextIndex ? [anchor, nextIndex] : [nextIndex, anchor];
                        const rangeSelection = new Set<number>();
                        for (let i = minIndex; i <= maxIndex; i += 1) {
                            rangeSelection.add(i);
                        }
                        updateSelectionState(rangeSelection);
                        selectionFocus$.set(nextIndex);
                    } else {
                        updateSelectionState(new Set([nextIndex]));
                        selectionAnchor$.set(nextIndex);
                        selectionFocus$.set(nextIndex);
                    }
                    return true;
                }

                case KeyCodes.KEY_RETURN:
                case KeyCodes.KEY_SPACE: {
                    const currentIndex = getPrimarySelectionIndex();
                    if (currentIndex >= 0 && currentIndex < items.length) {
                        handleTrackClick(currentIndex);
                    }
                    return true;
                }

                default:
                    return false;
            }
        };

        const removeListener = KeyboardManager.addKeyDownListener(handleKeyDown);
        return () => {
            removeListener();
        };
    }, [
        getPrimarySelectionIndex,
        handleTrackClick,
        items,
        selectedIndices$,
        selectionAnchor$,
        selectionFocus$,
        updateSelectionState,
    ]);

    return {
        selectedIndices$,
        handleTrackClick,
    };
}
