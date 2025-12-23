import { cssInterop } from "nativewind";
import type { ReactNode } from "react";
import { requireNativeComponent, type ViewProps } from "react-native";

export interface SplitViewResizeEvent {
    sizes: number[];
    isVertical: boolean;
}

export interface SplitViewProps extends ViewProps {
    children?: ReactNode;
    isVertical?: boolean;
    dividerThickness?: number;
    onSplitViewDidResize?: (event: { nativeEvent: SplitViewResizeEvent }) => void;
}

const NativeSplitView = requireNativeComponent<SplitViewProps>("RNSplitView");

cssInterop(NativeSplitView, {
    className: "style",
});

export function SplitView({ isVertical = true, style, ...props }: SplitViewProps) {
    const layoutStyle = { flexDirection: isVertical ? "row" : "column" };
    return <NativeSplitView {...props} isVertical={isVertical} style={[style, layoutStyle]} />;
}
