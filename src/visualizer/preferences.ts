import type { VisualizerMode } from "@/components/Visualizer/VisualizerCanvas";
import { createJSONManager } from "@/utils/JSONManager";

export interface VisualizerPreferences {
    window: {
        width: number;
        height: number;
        autoClose: boolean;
    };
    visualizer: {
        mode: VisualizerMode;
        binCount: number;
        smoothing: number;
        fftSize: number;
        throttleMs: number;
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
            mode: "spectrum",
            binCount: 64,
            smoothing: 0.6,
            fftSize: 1024,
            throttleMs: 33,
        },
    },
    saveDefaultToFile: true,
});
