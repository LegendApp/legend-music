// Minimal bar graph visualizer with discrete bins (no horizontal smoothing).

import { type ShaderDefinition, ShaderSurface } from "@/visualizer/shaders/ShaderSurface";

import type { VisualizerComponentProps, VisualizerPresetDefinition } from "./types";

const BAR_SHADER = `
uniform float2 u_resolution;
uniform float u_time;
uniform float u_amplitude;
uniform int u_binCount;
uniform float u_bins[128];

int clampIndex(int value) {
    if (u_binCount <= 0) {
        return 0;
    }
    int maxIndex = u_binCount - 1;
    if (maxIndex > 127) {
        maxIndex = 127;
    }
    if (value < 0) {
        return 0;
    }
    if (value > maxIndex) {
        return maxIndex;
    }
    return value;
}

float readBin(int target) {
    if (u_binCount <= 0) {
        return 0.0;
    }
    int clampedTarget = clampIndex(target);
    float value = 0.0;
    for (int i = 0; i < 128; ++i) {
        if (i >= u_binCount) {
            break;
        }
        if (i == clampedTarget) {
            value = u_bins[i];
        }
    }
    return clamp(value, 0.0, 1.0);
}

float3 barPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    float3 red = float3(0.95, 0.26, 0.28);
    float3 yellow = float3(0.98, 0.84, 0.22);
    float3 green = float3(0.2, 0.8, 0.45);
    float3 blue = float3(0.24, 0.56, 0.95);
    float3 purple = float3(0.72, 0.34, 0.88);

    if (t < 0.25) {
        float segmentT = t / 0.25;
        return mix(red, yellow, segmentT);
    }
    if (t < 0.5) {
        float segmentT = (t - 0.25) / 0.25;
        return mix(yellow, green, segmentT);
    }
    if (t < 0.75) {
        float segmentT = (t - 0.5) / 0.25;
        return mix(green, blue, segmentT);
    }
    float segmentT = (t - 0.75) / 0.25;
    return mix(blue, purple, segmentT);
}

half4 main(float2 fragCoord) {
    if (u_resolution.x <= 0.0 || u_resolution.y <= 0.0) {
        return half4(0.0, 0.0, 0.0, 1.0);
    }

    float2 uv = fragCoord / u_resolution;
    uv.y = 1.0 - uv.y;

    int binCount = u_binCount > 1 ? u_binCount : 1;
    float binCountF = float(binCount);
    float normalizedX = clamp(uv.x, 0.0, 0.999999);
    int binIndex = clampIndex(int(floor(normalizedX * binCountF)));

    float level = readBin(binIndex);
    float boosted = clamp(pow(level, 0.9) * (0.7 + u_amplitude * 0.6), 0.0, 0.8);
    float barHeight = pow(boosted, 0.85);

    float columnStart = float(binIndex) / binCountF;
    float columnEnd = float(binIndex + 1) / binCountF;
    float columnCenter = (columnStart + columnEnd) * 0.5;

    float lane = binCount > 1 ? float(binIndex) / float(binCount - 1) : 0.0;
    float3 gradient = barPalette(lane);
    float3 accent = float3(0.988, 0.796, 0.274);
    gradient = mix(gradient, accent, smoothstep(0.65, 1.0, lane) * 0.4);

    float barMask = step(uv.y, barHeight);
    float3 barColor = gradient;

    float background = 0.08 + 0.06 * sin(lane * 12.0 + u_time * 0.2);
    float3 baseColor = float3(background, background * 0.82, background * 1.05);

    float3 finalColor = mix(baseColor, barColor, barMask);
    finalColor = pow(finalColor, float3(1.15));

    return half4(finalColor, 1.0);
}
`;

const BAR_DEFINITION: ShaderDefinition = {
    shader: BAR_SHADER,
    audioConfig: {
        binCount: 64,
        smoothing: 0.45,
        throttleMs: 16,
    },
};

const BarVisualizer = ({ style, binCountOverride }: VisualizerComponentProps) => (
    <ShaderSurface definition={BAR_DEFINITION} style={style} binCountOverride={binCountOverride} />
);

export const barPreset: VisualizerPresetDefinition = {
    id: "bar",
    name: "Bar",
    Component: BarVisualizer,
};
