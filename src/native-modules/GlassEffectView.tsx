import { cssInterop } from "nativewind";
import type { ReactNode } from "react";
import { type ColorValue, requireNativeComponent, type ViewProps } from "react-native";

export type GlassEffectStyle = "regular" | "clear" | "sidebar";

export interface GlassEffectViewProps extends ViewProps {
    children: ReactNode;
    glassStyle: GlassEffectStyle;
    tintColor?: ColorValue;
}

const NativeGlassEffectView = requireNativeComponent<GlassEffectViewProps>("RNGlassEffectView");

cssInterop(NativeGlassEffectView, {
    className: "style",
});

export function GlassEffectView({ children, ...props }: GlassEffectViewProps) {
    return <NativeGlassEffectView {...props}>{children}</NativeGlassEffectView>;
}
