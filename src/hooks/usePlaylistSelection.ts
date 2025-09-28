import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useCallback, useEffect } from "react";
import type { NativeMouseEvent } from "react-native-macos";

import { playlistNavigationState$ } from "@/state/playlistNavigationState";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import { state$ } from "@/systems/State";

interface UsePlaylistSelectionOptions<T extends { isSeparator?: boolean }> {
    items: T[];
}

interface UsePlaylistSelectionResult {
    selectedIndices$: Observable<Set<number>>;
    handleTrackClick: (index: number, event?: NativeMouseEvent) => void;
}

function createRangeSelection(start: number, end: number): Set<number> {
    const [minIndex, maxIndex] = start < end ? [start, end] : [end, start];
    const selection = new Set<number>();

    for (let i = minIndex; i <= maxIndex; i += 1) {
        selection.add(i);
    }

    return selection;
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

    const setAnchorAndFocus = useCallback(
        (anchor: number, focus: number) => {
            selectionAnchor$.set(anchor);
            selectionFocus$.set(focus);
        },
        [selectionAnchor$, selectionFocus$],
    );

    const applySingleSelection = useCallback(
        (index: number) => {
            updateSelectionState(new Set<number>([index]));
            setAnchorAndFocus(index, index);
        },
        [setAnchorAndFocus, updateSelectionState],
    );

    const applyRangeSelection = useCallback(
        (anchor: number, focus: number) => {
            updateSelectionState(createRangeSelection(anchor, focus));
            selectionFocus$.set(focus);
        },
        [selectionFocus$, updateSelectionState],
    );

    const toggleSelection = useCallback(
        (index: number) => {
            const nextSelection = new Set(selectedIndices$.get());

            if (nextSelection.has(index)) {
                nextSelection.delete(index);
                updateSelectionState(nextSelection);

                if (nextSelection.size === 0) {
                    setAnchorAndFocus(-1, -1);
                    return;
                }

                if (selectionFocus$.get() === index) {
                    const nextFocus = Math.min(...nextSelection);
                    selectionFocus$.set(nextFocus);

                    if (!nextSelection.has(selectionAnchor$.get())) {
                        selectionAnchor$.set(nextFocus);
                    }
                }

                return;
            }

            nextSelection.add(index);
            updateSelectionState(nextSelection);
            setAnchorAndFocus(index, index);
        },
        [selectedIndices$, selectionAnchor$, selectionFocus$, setAnchorAndFocus, updateSelectionState],
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
            if (__DEV__) {
                console.log("Queue -> select index", index, {
                    shift: isShiftPressed,
                    meta: isMultiToggle,
                });
            }

            if (isShiftPressed) {
                const anchorIndex = selectionAnchor$.get();
                const start = anchorIndex !== -1 ? anchorIndex : index;
                applyRangeSelection(start, index);
                if (anchorIndex === -1) {
                    selectionAnchor$.set(index);
                }
                return;
            }

            if (isMultiToggle) {
                toggleSelection(index);
                return;
            }

            applySingleSelection(index);
        },
        [applyRangeSelection, applySingleSelection, items, selectionAnchor$, toggleSelection],
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
                        applyRangeSelection(selectionAnchor$.get(), newIndex);
                    } else {
                        applySingleSelection(newIndex);
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
                        applyRangeSelection(selectionAnchor$.get(), nextIndex);
                    } else {
                        applySingleSelection(nextIndex);
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
        applyRangeSelection,
        applySingleSelection,
        getPrimarySelectionIndex,
        handleTrackClick,
        items,
        selectedIndices$,
        selectionAnchor$,
        selectionFocus$,
        toggleSelection,
        updateSelectionState,
    ]);

    return {
        selectedIndices$,
        handleTrackClick,
    };
}
