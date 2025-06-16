import { Portal } from "@gorhom/portal";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
    Animated,
    type GestureResponderEvent,
    type LayoutChangeEvent,
    type LayoutRectangle,
    PanResponder,
    View,
} from "react-native";

import { ShadowDropdown } from "@/utils/styles";
import { useDragDrop } from "./DragDropContext";

interface DraggableItemProps<T = any> {
    id: string;
    zoneId: string;
    data: T;
    children: ReactNode;
    disabled?: boolean;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    className?: string;
}

export const DraggableItem = <T,>({
    id,
    zoneId,
    data,
    children,
    disabled = false,
    onDragStart,
    onDragEnd,
    className = "",
}: DraggableItemProps<T>) => {
    // Get the drag drop context
    const { draggedItem$, activeDropZone$, checkDropZones, getDropZoneById } = useDragDrop();

    // State for tracking position and dimensions
    const [_layout, setLayout] = useState<LayoutRectangle | null>(null);
    const initialPositionRef = useRef({ pageX: 0, pageY: 0 });
    const childMeasurementsRef = useRef<LayoutRectangle | null>(null);

    // Reference to the original view
    const viewRef = useRef<View>(null);

    // Portal item position state
    const [portalPosition, setPortalPosition] = useState({ top: 0, left: 0 });

    // State to track if we're in dragging mode
    const [isDragging, setIsDragging] = useState(false);
    // State to track if position is ready
    const [positionReady, setPositionReady] = useState(false);

    // Global position tracking for the dragged item
    const globalPositionRef = useRef({ x: 0, y: 0 });

    const [fadeOg, setFadeOg] = useState(false);

    // Animated values for position and scale
    const pan = useRef(new Animated.ValueXY()).current;

    // Clean up animated values on unmount to prevent memory leaks
    useEffect(() => {
        // Clean up function
        return () => {
            // Remove any listeners from the Animated values
            pan.x.removeAllListeners();
            pan.y.removeAllListeners();
        };
    }, [pan.x, pan.y]);

    useEffect(() => {
        requestAnimationFrame(() => {
            setFadeOg(isDragging);
        });
    }, [isDragging]);

    // Create the pan responder for the original item
    const originalPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !disabled,
            onMoveShouldSetPanResponder: () => !disabled,

            onPanResponderGrant: (e: GestureResponderEvent) => {
                // Ensure clean state before starting a new drag
                pan.flattenOffset();
                pan.setOffset({ x: 0, y: 0 });
                pan.setValue({ x: 0, y: 0 });
                globalPositionRef.current = { x: 0, y: 0 };
                // Reset position ready state
                setPositionReady(false);

                // Save initial touch position
                initialPositionRef.current = {
                    pageX: e.nativeEvent.pageX,
                    pageY: e.nativeEvent.pageY,
                };

                // Set dragging state first
                setIsDragging(true);

                // Trigger the drag start callback
                onDragStart?.();

                // Set the dragged item in the context
                draggedItem$.set({
                    id,
                    data,
                    sourceZoneId: zoneId,
                });

                // Find absolute position of the item for portal positioning
                if (viewRef.current && childMeasurementsRef.current) {
                    // More reliable positioning using element bounds and touch position
                    viewRef.current.measure((x, y, width, height, pageX, pageY) => {
                        setPortalPosition({
                            left: pageX,
                            top: pageY,
                        });
                        // Mark position as ready
                        setPositionReady(true);
                    });
                }
            },

            onPanResponderMove: (e: GestureResponderEvent, gestureState) => {
                // Update the position of the item
                pan.setValue({
                    x: gestureState.dx,
                    y: gestureState.dy,
                });

                // Update global position
                globalPositionRef.current = {
                    x: gestureState.dx,
                    y: gestureState.dy,
                };

                // Calculate current absolute position of the dragged item
                const currentX = initialPositionRef.current.pageX + gestureState.dx;
                const currentY = initialPositionRef.current.pageY + gestureState.dy;

                // Check if the item is over any drop zones
                checkDropZones(currentX, currentY);
            },

            onPanResponderRelease: () => {
                handleDragEnd();
            },
        }),
    ).current;

    // Shared function to handle drag end
    const handleDragEnd = () => {
        // Handle drop
        const activeDropZone = activeDropZone$.get();
        const isDropped = activeDropZone !== null;

        // If dropped, trigger the onDrop handler of the drop zone
        if (isDropped && activeDropZone) {
            const dropZone = getDropZoneById(activeDropZone);
            if (dropZone && draggedItem$.get()) {
                // Call the onDrop handler of the drop zone
                dropZone.onDrop(draggedItem$.get()!);
            }
        }

        // Reset the drag state
        setIsDragging(false);
        setPositionReady(false);
        draggedItem$.set(null);

        // Animate back to the original position
        const animation = Animated.timing(pan, {
            toValue: { x: 0, y: 0 },
            duration: isDropped ? 0 : 150, // If dropped, snap instantly
            useNativeDriver: true,
        });

        // Start the animation and add a completion callback
        animation.start(({ finished }) => {
            if (finished) {
                // Trigger the drag end callback
                onDragEnd?.();

                // Reset active drop zone after animation completes
                if (isDropped) {
                    activeDropZone$.set(null);
                }

                // Ensure pan is fully reset to prevent offset on next drag
                pan.setOffset({ x: 0, y: 0 });
                pan.setValue({ x: 0, y: 0 });
                globalPositionRef.current = { x: 0, y: 0 };

                // Reset portal position to avoid stale position on next drag
                setPortalPosition({ top: 0, left: 0 });
            }
        });
    };

    // Handle layout changes
    const onLayout = (event: LayoutChangeEvent) => {
        setLayout(event.nativeEvent.layout);
        childMeasurementsRef.current = event.nativeEvent.layout;
    };

    return (
        <View className="flex-grow-0">
            {/* Placeholder that stays in place */}
            <View ref={viewRef} onLayout={onLayout} className={className} style={{}}>
                <View
                    {...originalPanResponder.panHandlers}
                    // eslint-disable-next-line react-native/no-inline-styles
                    style={{
                        opacity: isDragging && fadeOg ? 0.2 : 1,
                    }}
                >
                    {children}
                </View>
            </View>

            {/* Dragged item in portal */}
            {isDragging && positionReady && childMeasurementsRef.current && (
                <Portal>
                    <Animated.View
                        className="rounded-md z-[9999] absolute bg-border-popup"
                        style={[
                            {
                                top: portalPosition.top - 1,
                                left: portalPosition.left - 1,
                                width: childMeasurementsRef.current.width + 2,
                                height: childMeasurementsRef.current.height + 2,
                                transform: [{ translateX: pan.x }, { translateY: pan.y }],
                                ...ShadowDropdown,
                            },
                        ]}
                    >
                        <View className="border border-border-popup rounded-md overflow-hidden">{children}</View>
                    </Animated.View>
                </Portal>
            )}
        </View>
    );
};
