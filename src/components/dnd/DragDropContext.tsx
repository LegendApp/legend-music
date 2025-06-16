import type { Observable } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import { createContext, type ReactNode, useContext, useRef } from "react";
import { type LayoutRectangle, View } from "react-native";

// Type for the dragged item
export interface DraggedItem<T = any> {
    id: string;
    data: T;
    sourceZoneId: string;
}

// Type for the drag drop context
interface DragDropContextValue {
    draggedItem$: Observable<DraggedItem | null>;
    registerDropZone: (
        id: string,
        rect: LayoutRectangle,
        allowDrop: (item: DraggedItem) => boolean,
        onDrop: (item: DraggedItem) => void,
    ) => void;
    unregisterDropZone: (id: string) => void;
    updateDropZoneRect: (id: string, rect: LayoutRectangle) => void;
    getDropZoneById: (id: string) => DropZone | undefined;
    activeDropZone$: Observable<string | null>;
    checkDropZones: (x: number, y: number) => void;
}

// Type for a drop zone
export interface DropZone {
    id: string;
    rect: LayoutRectangle;
    allowDrop: (item: DraggedItem) => boolean;
    onDrop: (item: DraggedItem) => void;
}

// Create context
const DragDropContext = createContext<DragDropContextValue | null>(null);

// Custom hook to use the drag drop context
export const useDragDrop = () => {
    const context = useContext(DragDropContext);
    if (!context) {
        throw new Error("useDragDrop must be used within a DragDropProvider");
    }
    return context;
};

// Props for the drag drop provider
interface DragDropProviderProps {
    children: ReactNode;
}

// DragDropProvider component
export const DragDropProvider = ({ children }: DragDropProviderProps) => {
    // State for the dragged item
    const draggedItem$ = useObservable<DraggedItem | null>(null);

    // State for the active drop zone
    const activeDropZone$ = useObservable<string | null>(null);

    // Ref for the drop zones
    const dropZonesRef = useRef<Map<string, DropZone>>(new Map());

    // Access current values
    const activeDropZone = use$(activeDropZone$);

    // Register a drop zone
    const registerDropZone = (
        id: string,
        rect: LayoutRectangle,
        allowDrop: (item: DraggedItem) => boolean,
        onDrop: (item: DraggedItem) => void,
    ) => {
        dropZonesRef.current.set(id, { id, rect, allowDrop, onDrop });
    };

    // Unregister a drop zone
    const unregisterDropZone = (id: string) => {
        dropZonesRef.current.delete(id);
    };

    // Update a drop zone's rect
    const updateDropZoneRect = (id: string, rect: LayoutRectangle) => {
        const dropZone = dropZonesRef.current.get(id);
        if (dropZone) {
            dropZonesRef.current.set(id, { ...dropZone, rect });
        }
    };

    // Get a drop zone by id
    const getDropZoneById = (id: string) => {
        return dropZonesRef.current.get(id);
    };

    // Check if an item is over any drop zones
    const checkDropZones = (x: number, y: number) => {
        const draggedItem = draggedItem$.get();
        if (!draggedItem) return;

        let foundDropZone = false;

        // Check each drop zone
        for (const [zoneId, dropZone] of dropZonesRef.current.entries()) {
            const { rect, allowDrop } = dropZone;

            // Check if the point is inside the drop zone
            const isInside = x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

            // Check if the drop zone allows this item to be dropped
            const canDrop = allowDrop(draggedItem);

            if (isInside && canDrop) {
                if (activeDropZone !== zoneId) {
                    activeDropZone$.set(zoneId);
                }
                foundDropZone = true;
                break;
            }
        }

        // If no drop zone was found, clear the active drop zone
        if (!foundDropZone && activeDropZone !== null) {
            activeDropZone$.set(null);
        }
    };

    // Value for the context
    const value: DragDropContextValue = {
        draggedItem$,
        registerDropZone,
        unregisterDropZone,
        updateDropZoneRect,
        getDropZoneById,
        activeDropZone$,
        checkDropZones,
    };

    return (
        <DragDropContext.Provider value={value}>
            <View className="flex-1">{children}</View>
        </DragDropContext.Provider>
    );
};
