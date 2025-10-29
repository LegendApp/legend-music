import { classicPreset } from "./classic";
import type { VisualizerPresetDefinition } from "./types";

export const visualizerPresets: VisualizerPresetDefinition[] = [classicPreset];

export const defaultVisualizerPresetId = visualizerPresets[0]?.id ?? classicPreset.id;

export function getVisualizerPresetById(id: string): VisualizerPresetDefinition {
    const fallback = visualizerPresets[0] ?? classicPreset;
    return visualizerPresets.find((preset) => preset.id === id) ?? fallback;
}

export * from "./types";
export { classicPreset } from "./classic";
