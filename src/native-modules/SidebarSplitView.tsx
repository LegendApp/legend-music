import { cssInterop } from "nativewind";
import type { ReactNode } from "react";
import { requireNativeComponent, type ViewProps } from "react-native";

export interface SidebarSplitViewResizeEvent {
    sizes: number[];
    isVertical: boolean;
}

export interface SidebarSplitViewProps extends ViewProps {
    children?: ReactNode;
    sidebarMinWidth?: number;
    contentMinWidth?: number;
    onSplitViewDidResize?: (event: { nativeEvent: SidebarSplitViewResizeEvent }) => void;
}

const NativeSidebarSplitView = requireNativeComponent<SidebarSplitViewProps>("RNSidebarSplitView");

cssInterop(NativeSidebarSplitView, {
    className: "style",
});

export function SidebarSplitView(props: SidebarSplitViewProps) {
    return <NativeSidebarSplitView {...props} />;
}
