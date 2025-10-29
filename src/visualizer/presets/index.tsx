import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import VisualizerCanvas from "@/components/Visualizer/VisualizerCanvas";

export interface VisualizerComponentProps {
    style?: StyleProp<ViewStyle>;
}

export interface VisualizerPresetDefinition {
    id: string;
    name: string;
    Component: ComponentType<VisualizerComponentProps>;
}

const ClassicVisualizer = (props: VisualizerComponentProps) => <VisualizerCanvas {...props} />;

export const visualizerPresets: VisualizerPresetDefinition[] = [
    {
        id: "classic",
        name: "Classic",
        Component: ClassicVisualizer,
    },
];

export const defaultVisualizerPresetId = visualizerPresets[0]?.id ?? "classic";

export function getVisualizerPresetById(id: string): VisualizerPresetDefinition {
    return visualizerPresets.find((preset) => preset.id === id) ?? visualizerPresets[0]!;
}
