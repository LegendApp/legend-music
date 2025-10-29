import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export interface VisualizerComponentProps {
    style?: StyleProp<ViewStyle>;
}

export interface VisualizerPresetDefinition {
    id: string;
    name: string;
    Component: ComponentType<VisualizerComponentProps>;
}
