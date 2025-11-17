import type { Observable } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react";
import { type GestureResponderEvent, PanResponder, type PanResponderGestureState, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useRefValue } from "@/hooks/useRefValue";
import { settings$ } from "@/systems/Settings";
import { cn } from "@/utils/cn";

// Context for sharing panel group state
interface PanelContextValue {
    direction: "horizontal" | "vertical";
    registerPanel: (panel: PanelConfig, sizeObservable: Observable<number>) => void;
    unregisterPanel: (panelId: string) => void;
    updatePanelSizes: (panelId: string, delta: number) => void;
    getPanelConfig: (id: string) => PanelConfig | undefined;
    getAllPanels: () => PanelConfig[];
    containerSize: number;
}

interface PanelConfig {
    id: string;
    size: number;
    minSize: number;
    maxSize: number | undefined;
    defaultSize: number;
    order: number;
}

const PanelContext = createContext<PanelContextValue | null>(null);

function usePanelContext(): PanelContextValue {
    const context = useContext(PanelContext);
    if (!context) {
        throw new Error("Panel components must be used within a PanelGroup");
    }
    return context;
}

// Panel Group Component
interface PanelGroupProps {
    children: ReactNode;
    direction?: "horizontal" | "vertical";
    className?: string;
}

export function PanelGroup({ children, direction = "horizontal", className }: PanelGroupProps) {
    const panels$ = settings$.state.panels;
    const refPanelConfigs = useRef<Record<string, PanelConfig>>({});
    const refPanelsArray = useRef<PanelConfig[]>([]);
    const containerSize$ = useObservable<number>(1000); // Default fallback
    const containerSizeState = use$(containerSize$);

    const registerPanel = useCallback(
        (panel: PanelConfig) => {
            if (!refPanelConfigs.current[panel.id]) {
                refPanelConfigs.current[panel.id] = panel;
                refPanelsArray.current.push(panel);
                refPanelsArray.current.sort((a, b) => a.order - b.order);

                // Use stored settings or default size
                let initialSize: number;
                if (panels$.get()[panel.id]) {
                    initialSize = panels$[panel.id].get() || panel.defaultSize;
                } else {
                    initialSize = panel.defaultSize;
                }

                // Validate initial size against constraints
                initialSize = Math.max(panel.minSize, initialSize);
                if (panel.maxSize) {
                    initialSize = Math.min(panel.maxSize, initialSize);
                }

                panels$[panel.id].set(initialSize);
            }
        },
        [panels$],
    );

    const unregisterPanel = useCallback((panelId: string) => {
        if (refPanelConfigs.current[panelId]) {
            delete refPanelConfigs.current[panelId];
            refPanelsArray.current = refPanelsArray.current.filter((panel) => panel.id !== panelId);
        }
    }, []);

    const getPanelConfig = (id: string): PanelConfig | undefined => {
        return refPanelConfigs.current[id];
    };

    const getAllPanels = (): PanelConfig[] => {
        return refPanelsArray.current;
    };

    const updatePanelSizes = (panelId: string, deltaPixels: number) => {
        const allPanels = getAllPanels();
        const currentPanelIndex = allPanels.findIndex((p) => p.id === panelId);

        if (currentPanelIndex < 0 || currentPanelIndex >= allPanels.length - 1) {
            return;
        }

        const currentPanel = allPanels[currentPanelIndex];
        const nextPanel = allPanels[currentPanelIndex + 1];

        if (!currentPanel || !nextPanel) {
            return;
        }

        const currentSize = panels$[currentPanel.id].get();
        const nextSize = panels$[nextPanel.id].get();

        // Calculate new sizes
        let newCurrentSize = currentSize + deltaPixels;
        let newNextSize = nextSize - deltaPixels;

        // Apply constraints
        newCurrentSize = Math.max(
            currentPanel.minSize,
            Math.min(currentPanel.maxSize || Number.POSITIVE_INFINITY, newCurrentSize),
        );

        newNextSize = Math.max(nextPanel.minSize, Math.min(nextPanel.maxSize || Number.POSITIVE_INFINITY, newNextSize));

        // Calculate actual changes after constraints
        const actualCurrentDelta = newCurrentSize - currentSize;
        const actualNextDelta = newNextSize - nextSize;

        // Only update if there's actually a change
        if (Math.abs(actualCurrentDelta) > 0.01 || Math.abs(actualNextDelta) > 0.01) {
            panels$[currentPanel.id].set(newCurrentSize);
            panels$[nextPanel.id].set(newNextSize);
            validateAndFixPanelSizes();
        }
    };

    const validateAndFixPanelSizes = useCallback(() => {
        const allPanels = getAllPanels();
        const containerSize = containerSize$.get();
        if (allPanels.length === 0 || containerSize <= 0) {
            return;
        }

        let needsValidation = false;
        const adjustments: { id: string; newSize: number }[] = [];

        // Step 1: Apply min/max constraints
        const panelSizes: Record<string, number> = {};
        for (const panel of allPanels) {
            const currentSize = panels$[panel.id].get();
            let newSize = currentSize;

            // Apply min constraint
            if (currentSize < panel.minSize) {
                newSize = panel.minSize;
                needsValidation = true;
            }

            // Apply max constraint
            if (panel.maxSize && currentSize > panel.maxSize) {
                newSize = panel.maxSize;
                needsValidation = true;
            }

            panelSizes[panel.id] = newSize;
            if (newSize !== currentSize) {
                adjustments.push({ id: panel.id, newSize });
            }
        }

        // Step 2: Check if total size exceeds container
        const totalSize = Object.values(panelSizes).reduce((sum, size) => sum + size, 0);
        if (totalSize > containerSize) {
            needsValidation = true;
            const excessSize = totalSize - containerSize;

            // Find panels that can be shrunk (above their minimum size)
            const shrinkablePanels = allPanels.filter((panel) => panelSizes[panel.id] > panel.minSize);

            if (shrinkablePanels.length > 0) {
                // Calculate how much each panel can be shrunk
                const totalShrinkableAmount = shrinkablePanels.reduce(
                    (sum, panel) => sum + (panelSizes[panel.id] - panel.minSize),
                    0,
                );

                if (totalShrinkableAmount >= excessSize) {
                    // Proportionally shrink panels based on how much they can be shrunk
                    for (const panel of shrinkablePanels) {
                        const maxShrink = panelSizes[panel.id] - panel.minSize;
                        const proportionalShrink = (maxShrink / totalShrinkableAmount) * excessSize;
                        const newSize = panelSizes[panel.id] - proportionalShrink;

                        panelSizes[panel.id] = Math.max(panel.minSize, newSize);

                        // Update or add to adjustments
                        const existingAdjustment = adjustments.find((adj) => adj.id === panel.id);
                        if (existingAdjustment) {
                            existingAdjustment.newSize = panelSizes[panel.id];
                        } else {
                            adjustments.push({ id: panel.id, newSize: panelSizes[panel.id] });
                        }
                    }
                } else {
                    // If we can't shrink enough while respecting minimums,
                    // shrink all shrinkable panels to their minimums
                    for (const panel of shrinkablePanels) {
                        panelSizes[panel.id] = panel.minSize;

                        const existingAdjustment = adjustments.find((adj) => adj.id === panel.id);
                        if (existingAdjustment) {
                            existingAdjustment.newSize = panel.minSize;
                        } else {
                            adjustments.push({ id: panel.id, newSize: panel.minSize });
                        }
                    }
                }
            }
        }

        console.log({ adjustments, needsValidation, totalSize, containerSize });

        // Apply the adjustments if any were needed
        if (needsValidation && adjustments.length > 0) {
            for (const adjustment of adjustments) {
                panels$[adjustment.id].set(adjustment.newSize);
            }
        }
    }, [getAllPanels, panels$]);

    const handleContainerLayout = (event: any) => {
        const { width, height } = event.nativeEvent.layout;
        const size = direction === "horizontal" ? width : height;
        containerSize$.set(size);

        // Validate panel sizes after layout change
        validateAndFixPanelSizes();
    };

    const contextValue: PanelContextValue = {
        direction,
        registerPanel,
        unregisterPanel,
        updatePanelSizes,
        getPanelConfig,
        getAllPanels,
        containerSize: containerSizeState,
    };

    return (
        <PanelContext.Provider value={contextValue}>
            <View
                className={cn("flex-1", direction === "horizontal" ? "flex-row" : "flex-col", className)}
                onLayout={handleContainerLayout}
            >
                {children}
            </View>
        </PanelContext.Provider>
    );
}

// Panel Component
interface PanelProps {
    children: ReactNode;
    id: string;
    minSize?: number;
    maxSize?: number;
    defaultSize: number;
    order?: number;
    className?: string;
    flex?: boolean;
}

function Panel({ children, id, minSize = 100, maxSize, defaultSize, order = 0, className, flex = false }: PanelProps) {
    const { registerPanel, unregisterPanel, direction } = usePanelContext();
    const size$ = settings$.state.panels[id];
    const size = use$(size$);

    // Register panel on mount
    useEffect(() => {
        const panelConfig: PanelConfig = {
            id,
            size: size$.get(),
            minSize,
            maxSize,
            defaultSize,
            order,
        };
        registerPanel(panelConfig, size$);

        // Cleanup: unregister panel when id changes or component unmounts
        return () => {
            unregisterPanel(id);
        };
    }, [id, minSize, maxSize, defaultSize, order, registerPanel, unregisterPanel, size$]);

    // Calculate style - use flexBasis for initial size and maxWidth/maxHeight for limits
    const isHorizontal = direction === "horizontal";
    const style = {
        flexBasis: size,
        flexGrow: flex ? 1 : 0,
        flexShrink: 0,
        ...(isHorizontal
            ? {
                  minWidth: minSize,
                  ...(maxSize ? { maxWidth: maxSize } : {}),
              }
            : {
                  minHeight: minSize,
                  ...(maxSize ? { maxHeight: maxSize } : {}),
              }),
    };

    return (
        <View style={style} className={className}>
            {children}
        </View>
    );
}

// Panel Resize Handle Component
interface PanelResizeHandleProps {
    panelId: string;
    className?: string;
    disabled?: boolean;
    hitAreaMargins?: number;
    onDragging?: (isDragging: boolean) => void;
}

export function PanelResizeHandle({
    panelId,
    className,
    disabled = false,
    hitAreaMargins = 15,
    onDragging,
}: PanelResizeHandleProps) {
    const { direction, updatePanelSizes } = usePanelContext();
    const isDragging = useSharedValue(false);
    const lastDelta = useRef(0);
    const refPanelId = useRefValue(panelId);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !disabled,
            onMoveShouldSetPanResponder: () => !disabled,
            onPanResponderGrant: () => {
                lastDelta.current = 0;
                isDragging.value = true;
                runOnJS(() => onDragging?.(true))();
            },
            onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
                if (disabled) {
                    return;
                }

                const currentDelta = direction === "horizontal" ? gestureState.dx : gestureState.dy;
                const deltaSinceLastUpdate = currentDelta - lastDelta.current;
                lastDelta.current = currentDelta;

                if (Math.abs(deltaSinceLastUpdate) > 1) {
                    runOnJS(() => {
                        updatePanelSizes(refPanelId.current, deltaSinceLastUpdate);
                    })();
                }
            },
            onPanResponderRelease: () => {
                lastDelta.current = 0;
                isDragging.value = false;
                runOnJS(() => onDragging?.(false))();
            },
        }),
    ).current;

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: withSpring(isDragging.value ? 0.8 : 1),
        backgroundColor: isDragging.value ? "rgba(0, 122, 255, 0.6)" : "transparent",
    }));

    const isVertical = direction === "vertical";

    return (
        <Animated.View
            style={[animatedStyle, { cursor: isVertical ? "ns-resize" : "ew-resize" }]}
            className={cn(
                "relative z-10 flex justify-center items-center bg-transparent",
                isVertical ? "h-1 w-full" : "w-1 -m-0.5 h-screen",
                disabled && "pointer-events-none opacity-50",
                className,
            )}
            {...panResponder.panHandlers}
        >
            <View className={cn("bg-transparent", isVertical ? "h-[1px] w-full" : "w-[1px] h-full")} />
            {/* Hit area for easier grabbing */}
            <View
                className="absolute"
                style={{
                    [isVertical ? "height" : "width"]: hitAreaMargins,
                    [isVertical ? "width" : "height"]: "100%",
                }}
            />
        </Animated.View>
    );
}

// Export all components
export { PanelGroup as Group, Panel, PanelResizeHandle as ResizeHandle };
