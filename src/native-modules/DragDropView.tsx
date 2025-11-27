import { cssInterop } from "nativewind";
import { forwardRef, type ReactNode } from "react";
import { type NativeSyntheticEvent, requireNativeComponent, type ViewProps } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";
import { SUPPORTED_AUDIO_EXTENSIONS } from "@/systems/audioFormats";

interface DragDropEvent {
    files: string[];
    directories?: string[];
}

export interface TrackDragEnterEvent {
    tracks: NativeDragTrack[];
}

export interface TrackDragEvent {
    tracks?: NativeDragTrack[];
    location: {
        x: number;
        y: number;
    };
}

export interface NativeDragTrack {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration?: string;
    filePath?: string;
    fileName?: string;
    thumbnail?: string;
    queueEntryId?: string;
}

interface DragDropViewProps extends ViewProps {
    children?: ReactNode;
    allowedFileTypes?: readonly string[];
    onDragEnter?: () => void;
    onDragLeave?: () => void;
    onDrop?: (event: { nativeEvent: DragDropEvent }) => void;
    onTrackDragEnter?: (event: { nativeEvent: TrackDragEnterEvent }) => void;
    onTrackDragLeave?: () => void;
    onTrackDragHover?: (event: { nativeEvent: TrackDragEvent }) => void;
    onTrackDrop?: (event: { nativeEvent: TrackDragEvent }) => void;
    onMouseDown?: (event: NativeSyntheticEvent<NativeMouseEvent>) => void;
}

const NativeDragDropView = requireNativeComponent<DragDropViewProps>("RNDragDrop");

// Enable NativeWind className support for the native component
cssInterop(NativeDragDropView, {
    className: "style",
});

type DragDropViewHandle = React.ElementRef<typeof NativeDragDropView>;

export const DragDropView = forwardRef<DragDropViewHandle, DragDropViewProps>(
    (
        {
            children,
            allowedFileTypes = SUPPORTED_AUDIO_EXTENSIONS,
            onDragEnter,
            onDragLeave,
            onDrop,
            onTrackDragEnter,
            onTrackDragLeave,
            onTrackDragHover,
            onTrackDrop,
            ...props
        },
        ref,
    ) => {
        return (
            <NativeDragDropView
                ref={ref}
                allowedFileTypes={allowedFileTypes}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onTrackDragEnter={onTrackDragEnter}
                onTrackDragLeave={onTrackDragLeave}
                onTrackDragHover={onTrackDragHover}
                onTrackDrop={onTrackDrop}
                {...props}
            >
                {children}
            </NativeDragDropView>
        );
    },
);

DragDropView.displayName = "DragDropView";
