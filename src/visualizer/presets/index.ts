import { classicPreset } from "./classic";
import { cubescapePreset } from "./cubescape";
import { auroraPreset } from "./aurora";
import { sunsetPreset } from "./sunset";
import type { VisualizerPresetDefinition } from "./types";

export const visualizerPresets: VisualizerPresetDefinition[] = [
    classicPreset,
    cubescapePreset,
    auroraPreset,
    sunsetPreset,
];

export const defaultVisualizerPresetId = visualizerPresets[0]?.id ?? classicPreset.id;

export function getVisualizerPresetById(id: string): VisualizerPresetDefinition {
    const fallback = visualizerPresets[0] ?? classicPreset;
    return visualizerPresets.find((preset) => preset.id === id) ?? fallback;
}

export * from "./types";
export { classicPreset } from "./classic";
export { cubescapePreset } from "./cubescape";
export { auroraPreset } from "./aurora";
export { sunsetPreset } from "./sunset";
