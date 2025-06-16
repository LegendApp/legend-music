import { use$ } from "@legendapp/state/react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { type LayoutChangeEvent, type LayoutRectangle, View } from "react-native";

import { cn } from "@/utils/cn";
import { type DraggedItem, useDragDrop } from "./DragDropContext";

interface DroppableZoneProps {
    id?: string;
    allowDrop: (item: DraggedItem) => boolean;
    onDrop: (item: DraggedItem) => void;
    children: ReactNode;
    className?: string;
    activeClassName?: string;
}

export const DroppableZone = ({
    id: propId,
    allowDrop,
    onDrop,
    children,
    className = "",
    activeClassName = "",
}: DroppableZoneProps) => {
    // Generate an ID if one wasn't provided
    const generatedId = useId();
    const id = propId || generatedId;

    // Get the drag drop context
    const { registerDropZone, unregisterDropZone, updateDropZoneRect, draggedItem$, activeDropZone$ } = useDragDrop();

    // Access the current values of observables
    const draggedItem = use$(draggedItem$);
    const activeDropZone = use$(activeDropZone$);

    // Keep track of the zone's layout
    const layoutRef = useRef<LayoutRectangle>({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    });

    // Register the drop zone on mount and unregister on unmount
    useEffect(() => {
        registerDropZone(id, layoutRef.current, allowDrop, onDrop);

        return () => {
            unregisterDropZone(id);
        };
    }, [id, registerDropZone, unregisterDropZone, allowDrop, onDrop]);

    // Handle layout changes
    const onLayout = (event: LayoutChangeEvent) => {
        const layout = event.nativeEvent.layout;
        Object.assign(layoutRef.current, layout);

        // Update the drop zone's rect
        updateDropZoneRect(id, layout);
    };

    // Determine if this zone is active (has a dragged item over it)
    const isActive = draggedItem !== null && activeDropZone === id;

    return (
        <View onLayout={onLayout} className={cn(className, isActive && activeClassName)}>
            {children}
        </View>
    );
};
