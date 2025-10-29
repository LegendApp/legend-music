import { ShaderSurface, type ShaderDefinition } from "@/visualizer/shaders/ShaderSurface";

import type { VisualizerComponentProps, VisualizerPresetDefinition } from "./types";

const CLASSIC_SHADER = `
uniform float2 u_resolution;
uniform float u_time;
uniform float u_amplitude;
uniform int u_binCount;
uniform float u_bins[128];

float sampleBin(float normalizedX) {
    if (u_binCount <= 0) {
        return 0.0;
    }

    float scaled = normalizedX * float(u_binCount - 1);
    float clamped = clamp(scaled, 0.0, float(u_binCount - 1));
    int index = int(floor(clamped));
    int nextIndex = min(u_binCount - 1, index + 1);
    float mixAmount = fract(clamped);
    float current = clamp(u_bins[index], 0.0, 1.0);
    float nextValue = clamp(u_bins[nextIndex], 0.0, 1.0);
    return mix(current, nextValue, mixAmount);
}

half4 main(float2 fragCoord) {
    if (u_resolution.x <= 0.0 || u_resolution.y <= 0.0) {
        return half4(0.0, 0.0, 0.0, 1.0);
    }

    float2 uv = fragCoord / u_resolution;
    uv.y = 1.0 - uv.y;

    float magnitude = sampleBin(clamp(uv.x, 0.0, 1.0));
    float strength = pow(magnitude, 0.6);
    float barHeight = max(0.02, strength);

    float base = smoothstep(barHeight, barHeight - 0.18, uv.y);
    float glow = smoothstep(0.0, 0.25, barHeight - uv.y);
    float wave = sin(uv.x * 10.0 + u_time * 1.8) * 0.05;
    float intensity = clamp(base + glow * 0.75 + wave, 0.0, 1.0);

    float background = 0.08 + clamp(u_amplitude * 1.35, 0.0, 1.0) * 0.2;

    float3 colorA = float3(0.0549, 0.6470, 0.9137);
    float3 colorB = float3(0.6588, 0.3333, 0.9686);
    float3 colorC = float3(0.9765, 0.4510, 0.0863);

    float blendAB = smoothstep(0.0, 0.45, uv.x);
    float blendBC = smoothstep(0.35, 1.0, uv.x);

    float3 gradient = mix(colorA, colorB, blendAB);
    gradient = mix(gradient, colorC, blendBC);

    float3 rgb = mix(float3(background), gradient, intensity);
    return half4(rgb, 1.0);
}
`;

const CLASSIC_DEFINITION: ShaderDefinition = {
    shader: CLASSIC_SHADER,
    audioConfig: {
        binCount: 96,
        smoothing: 0.62,
        throttleMs: 16,
    },
};

const ClassicVisualizer = ({ style }: VisualizerComponentProps) => (
    <ShaderSurface definition={CLASSIC_DEFINITION} style={style} />
);

export const classicPreset: VisualizerPresetDefinition = {
    id: "classic",
    name: "Classic",
    Component: ClassicVisualizer,
};
