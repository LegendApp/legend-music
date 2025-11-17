import { cssInterop } from "nativewind";
import type { ReactNode } from "react";
import { requireNativeComponent, type ViewProps } from "react-native";
import type { NativeDragTrack } from "@/native-modules/DragDropView";

interface TrackDragSourceNativeProps extends ViewProps {
    children?: ReactNode;
    trackPayload: NativeDragTrack[];
    onDragStart?: () => void;
}

export interface TrackDragSourceProps extends ViewProps {
    children?: ReactNode;
    tracks: NativeDragTrack[];
    onDragStart?: () => void;
}

export type { NativeDragTrack } from "@/native-modules/DragDropView";

const NativeTrackDragSourceView = requireNativeComponent<TrackDragSourceNativeProps>("RNTrackDragSource");

cssInterop(NativeTrackDragSourceView, {
    className: "style",
});

export function TrackDragSource({ children, tracks, onDragStart, ...props }: TrackDragSourceProps) {
    return (
        <NativeTrackDragSourceView trackPayload={tracks} onDragStart={onDragStart} {...props}>
            {children}
        </NativeTrackDragSourceView>
    );
}
