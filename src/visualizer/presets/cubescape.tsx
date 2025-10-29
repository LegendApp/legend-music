// Inspired by "Cubescape" — https://www.shadertoy.com/view/Msl3Rr

import { ShaderSurface, type ShaderDefinition } from "@/visualizer/shaders/ShaderSurface";

import type { VisualizerComponentProps, VisualizerPresetDefinition } from "./types";

const CUBESCAPE_SHADER = `
uniform float2 u_resolution;
uniform float u_time;
uniform float u_amplitude;
uniform int u_binCount;
uniform float u_bins[128];

float saturate(float value) {
    return clamp(value, 0.0, 1.0);
}

float sampleBin(int index) {
    if (u_binCount <= 0) {
        return 0.0;
    }
    int clamped = clamp(index, 0, u_binCount - 1);
    return saturate(u_bins[clamped] * 1.6);
}

half4 main(float2 fragCoord) {
    if (u_resolution.x <= 0.0 || u_resolution.y <= 0.0) {
        return half4(0.0, 0.0, 0.0, 1.0);
    }

    float2 uv = fragCoord / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    float2 p = uv * 2.0 - 1.0;
    p.x *= aspect;

    float time = u_time * 0.45;
    float amplitude = saturate(u_amplitude * 3.5);
    float bass = sampleBin(0);

    float3 color = float3(0.02, 0.05, 0.1);

    for (int layer = 0; layer < 5; layer++) {
        float layerIndex = float(layer);
        float depth = fract(time + layerIndex * 0.22);
        float scale = mix(0.7, 3.5, depth);

        float2 layerUv = p * scale;
        layerUv += float2(time * 1.1 + layerIndex * 0.35, time * 0.7 + layerIndex * 0.42);

        float2 cell = fract(layerUv) - 0.5;
        float edge = max(abs(cell.x), abs(cell.y));

        float cube = 1.0 - smoothstep(0.2, 0.5, edge);
        float glow = 1.0 - smoothstep(0.05, 0.32, edge);

        int binIndex = layer * 16;
        float energy = sampleBin(binIndex) + bass * 0.4 + amplitude * 0.6;
        float height = pow(1.0 - depth, 2.0) * (0.6 + energy * 1.4);
        float brightness = cube * height;

        float3 layerColor = mix(float3(0.08, 0.25, 0.55), float3(0.92, 0.34, 0.82), (layerIndex + depth) / 5.0);
        color += layerColor * brightness;
        color += float3(0.9, 0.8, 0.6) * glow * (0.35 + energy * 0.5) * pow(1.0 - depth, 1.5);
    }

    color = clamp(color, 0.0, 1.0);

    return half4(color, 1.0);
}
`;

const CUBESCAPE_DEFINITION: ShaderDefinition = {
    shader: CUBESCAPE_SHADER,
    audioConfig: {
        binCount: 96,
        smoothing: 0.58,
        throttleMs: 18,
    },
};

const CubescapeVisualizer = ({ style }: VisualizerComponentProps) => (
    <ShaderSurface definition={CUBESCAPE_DEFINITION} style={style} />
);

export const cubescapePreset: VisualizerPresetDefinition = {
    id: "cubescape",
    name: "Cubescape",
    Component: CubescapeVisualizer,
};
