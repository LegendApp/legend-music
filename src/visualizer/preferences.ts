import { createJSONManager } from "@/utils/JSONManager";

export interface VisualizerPreferences {
    window: {
        width: number;
        height: number;
    };
    visualizer: {
        selectedPresetId: string;
        binCount: number;
    };
}

export const visualizerPreferences$ = createJSONManager<VisualizerPreferences>({
    basePath: "Cache",
    filename: "visualizerSettings",
    initialValue: {
        window: {
            width: 780,
            height: 420,
        },
        visualizer: {
            selectedPresetId: "classic",
            binCount: 64,
        },
    },
    saveDefaultToFile: true,
});
