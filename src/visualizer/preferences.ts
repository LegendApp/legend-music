import { createJSONManager } from "@/utils/JSONManager";

export interface VisualizerPreferences {
    window: {
        width: number;
        height: number;
        autoClose: boolean;
    };
    visualizer: {
        selectedPresetId: string;
    };
}

export const visualizerPreferences$ = createJSONManager<VisualizerPreferences>({
    basePath: "Cache",
    filename: "visualizerSettings",
    initialValue: {
        window: {
            width: 780,
            height: 420,
            autoClose: true,
        },
        visualizer: {
            selectedPresetId: "classic",
        },
    },
    saveDefaultToFile: true,
});
