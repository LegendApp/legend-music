import {
    defaultVisualizerPresetId,
    getVisualizerPresetById,
    visualizerPresets,
} from "@/visualizer/presets";

describe("visualizer presets registry", () => {
    it("exposes the classic, cubescape, and sunset presets", () => {
        const ids = visualizerPresets.map((preset) => preset.id);
        expect(ids).toEqual(expect.arrayContaining(["classic", "cubescape", "sunset"]));
    });

    it("falls back to the default preset when an unknown id is requested", () => {
        const preset = getVisualizerPresetById("unknown-preset");
        expect(preset.id).toBe(defaultVisualizerPresetId);
    });
});
