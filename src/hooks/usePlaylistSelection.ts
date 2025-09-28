import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useCallback } from "react";
import type { NativeMouseEvent } from "react-native-macos";
import { queue$ } from "@/components/LocalAudioPlayer";
import { playlistNavigationState$ } from "@/state/playlistNavigationState";
import { keysPressed$, useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import { state$ } from "@/systems/State";

interface UsePlaylistSelectionOptions<T extends { isSeparator?: boolean }> {
    items: T[];
    onDeleteSelection?: (indices: number[]) => void;
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
    const { items, onDeleteSelection } = options;
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

    const clearSelection = useCallback(() => {
        updateSelectionState(new Set());
        setAnchorAndFocus(-1, -1);
    }, [setAnchorAndFocus, updateSelectionState]);

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

    const isModifierPressed = useCallback((modifier: number) => {
        return Boolean(keysPressed$.get()[modifier]);
    }, []);

    const shouldHandleHotkeys = useCallback((itemsLength: number) => {
        if (itemsLength === 0) {
            return false;
        }

        if (playlistNavigationState$.isSearchDropdownOpen.get()) {
            return false;
        }

        if (state$.isDropdownOpen.get()) {
            return false;
        }

        return true;
    }, []);

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

    const moveSelectionUp = useCallback(() => {
        console.log("up");
        const itemsLength = queue$.tracks.length;
        if (!shouldHandleHotkeys(itemsLength)) {
            return;
        }

        const hasShift = isModifierPressed(KeyCodes.MODIFIER_SHIFT);
        const currentFocus = selectionFocus$.get();
        const currentSelection = selectedIndices$.get();
        const currentIndex =
            currentFocus !== -1 ? currentFocus : currentSelection.size > 0 ? Math.min(...currentSelection) : 0;
        const nextIndex = currentIndex <= 0 ? itemsLength - 1 : currentIndex - 1;

        if (hasShift && selectionAnchor$.get() !== -1) {
            applyRangeSelection(selectionAnchor$.get(), nextIndex);
        } else {
            applySingleSelection(nextIndex);
        }
    }, [
        applyRangeSelection,
        applySingleSelection,
        isModifierPressed,
        selectedIndices$,
        selectionAnchor$,
        selectionFocus$,
        shouldHandleHotkeys,
    ]);

    const moveSelectionDown = useCallback(() => {
        const itemsLength = queue$.tracks.length;
        console.log("down", shouldHandleHotkeys(itemsLength));

        if (!shouldHandleHotkeys(itemsLength)) {
            return;
        }

        const hasShift = isModifierPressed(KeyCodes.MODIFIER_SHIFT);
        const currentFocus = selectionFocus$.get();
        const currentSelection = selectedIndices$.get();
        const currentIndex =
            currentFocus !== -1 ? currentFocus : currentSelection.size > 0 ? Math.max(...currentSelection) : -1;
        const nextIndex = currentIndex >= queue$.tracks.length - 1 || currentIndex === -1 ? 0 : currentIndex + 1;

        console.log("moveSelectionDown", currentIndex, nextIndex);

        if (hasShift && selectionAnchor$.get() !== -1) {
            applyRangeSelection(selectionAnchor$.get(), nextIndex);
        } else {
            applySingleSelection(nextIndex);
        }
    }, [
        applyRangeSelection,
        applySingleSelection,
        isModifierPressed,
        selectedIndices$,
        selectionAnchor$,
        selectionFocus$,
        shouldHandleHotkeys,
    ]);

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

    const activateSelection = useCallback(() => {
        const itemsLength = queue$.tracks.length;
        if (!shouldHandleHotkeys(itemsLength)) {
            return;
        }

        const currentIndex = getPrimarySelectionIndex();
        if (currentIndex >= 0 && currentIndex < itemsLength) {
            handleTrackClick(currentIndex);
        }
    }, [getPrimarySelectionIndex, handleTrackClick, shouldHandleHotkeys]);

    const handleDeleteHotkey = useCallback(() => {
        const itemsLength = queue$.tracks.length;
        if (!onDeleteSelection || !shouldHandleHotkeys(itemsLength)) {
            return;
        }

        const currentSelection = selectedIndices$.get();
        if (currentSelection.size === 0) {
            return;
        }

        const indices = Array.from(currentSelection).sort((a, b) => a - b);
        onDeleteSelection(indices);
        clearSelection();
    }, [clearSelection, onDeleteSelection, selectedIndices$, shouldHandleHotkeys]);

    useOnHotkeys({
        Up: moveSelectionUp,
        Down: moveSelectionDown,
        Enter: activateSelection,
        Space: activateSelection,
        Delete: onDeleteSelection ? handleDeleteHotkey : undefined,
    });

    return {
        selectedIndices$,
        handleTrackClick,
    };
}
