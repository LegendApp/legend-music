import { observable } from "@legendapp/state";
import { useSelector } from "@legendapp/state/react";
import { useCallback, useRef } from "react";
import type { LayoutChangeEvent } from "react-native";
import { useWindowId } from "./WindowProvider";

export type WindowDimensions = {
    width: number;
    height: number;
};

const DEFAULT_DIMENSIONS: WindowDimensions = { width: 0, height: 0 };

export const windowDimensionsById$ = observable<Record<string, WindowDimensions>>({});

const normalizeDimensions = (width: number, height: number): WindowDimensions => ({
    width: Math.round(width),
    height: Math.round(height),
});

export const setWindowDimensionsForId = (windowId: string, dimensions: WindowDimensions) => {
    if (!windowId) {
        return;
    }

    const current = windowDimensionsById$[windowId].peek();
    if (current && current.width === dimensions.width && current.height === dimensions.height) {
        return;
    }

    windowDimensionsById$[windowId].set(dimensions);
};

export const useCurrentWindowDimensions = (): WindowDimensions => {
    const windowId = useWindowId();

    return useSelector(() => {
        if (!windowId) {
            return DEFAULT_DIMENSIONS;
        }
        return windowDimensionsById$[windowId].get() ?? DEFAULT_DIMENSIONS;
    });
};

export const useWindowLayoutReporter = () => {
    const windowId = useWindowId();
    const lastDimensionsRef = useRef<WindowDimensions | null>(null);

    return useCallback(
        (event: LayoutChangeEvent) => {
            if (!windowId) {
                return;
            }

            const { width, height } = event.nativeEvent.layout;
            if (width <= 0 || height <= 0) {
                return;
            }

            const nextDimensions = normalizeDimensions(width, height);
            const lastDimensions = lastDimensionsRef.current;

            if (
                lastDimensions &&
                lastDimensions.width === nextDimensions.width &&
                lastDimensions.height === nextDimensions.height
            ) {
                return;
            }

            lastDimensionsRef.current = nextDimensions;
            setWindowDimensionsForId(windowId, nextDimensions);
        },
        [windowId],
    );
};
