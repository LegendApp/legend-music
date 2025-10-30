import { observable } from "@legendapp/state";

export interface VisualizerDiagnosticsState {
    fps: number;
    frameIntervalMs: number;
    tapDurationMs: number;
    throttleMs: number;
    binCount: number;
    updatedAt: number;
}

export const visualizerDiagnostics$ = observable<VisualizerDiagnosticsState>({
    fps: 0,
    frameIntervalMs: 0,
    tapDurationMs: 0,
    throttleMs: 0,
    binCount: 0,
    updatedAt: 0,
});
