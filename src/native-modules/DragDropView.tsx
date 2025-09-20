import { cssInterop } from "nativewind";
import type { ReactNode } from "react";
import { requireNativeComponent, type ViewProps } from "react-native";

interface DragDropEvent {
    files: string[];
}

interface DragDropViewProps extends ViewProps {
    children?: ReactNode;
    allowedFileTypes?: string[];
    onDragEnter?: () => void;
    onDragLeave?: () => void;
    onDrop?: (event: { nativeEvent: DragDropEvent }) => void;
}

const NativeDragDropView = requireNativeComponent<DragDropViewProps>("RNDragDrop");

// Enable NativeWind className support for the native component
cssInterop(NativeDragDropView, {
    className: "style",
});

export function DragDropView({
    children,
    allowedFileTypes = ["mp3", "wav", "m4a", "aac", "flac"],
    onDragEnter,
    onDragLeave,
    onDrop,
    ...props
}: DragDropViewProps) {
    return (
        <NativeDragDropView
            allowedFileTypes={allowedFileTypes}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            {...props}
        >
            {children}
        </NativeDragDropView>
    );
}
