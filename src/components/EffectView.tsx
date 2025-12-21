import { type BlendingMode, type Material, type State, VibrancyView } from "@fluentui-react-native/vibrancy-view";
import type { ReactNode } from "react";
import type { ColorValue, ViewProps } from "react-native";
import { type GlassEffectStyle, GlassEffectView } from "@/native-modules/GlassEffectView";
import { IS_TAHOE } from "@/systems/constants";

export interface EffectViewProps extends ViewProps {
    children?: ReactNode;
    glassStyle?: GlassEffectStyle;
    tintColor?: ColorValue;
    blendingMode?: BlendingMode;
    material?: Material;
    state?: State;
}

export function EffectView({
    children,
    glassStyle = "regular",
    tintColor = "#00000033",
    blendingMode = "behindWindow",
    material = "sidebar",
    state,
    ...props
}: EffectViewProps) {
    if (IS_TAHOE) {
        return (
            <GlassEffectView glassStyle={glassStyle} tintColor={tintColor} {...props}>
                {children}
            </GlassEffectView>
        );
    } else {
        console.log("rendering a vibrancy view");
        return (
            <VibrancyView blendingMode={blendingMode} material={material} state={state} {...props}>
                {children}
            </VibrancyView>
        );
    }
}
