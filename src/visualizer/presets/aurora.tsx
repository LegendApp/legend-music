// Radial bar visualizer inspired by the linear bar preset, mapped into polar coordinates.

import { type ShaderDefinition, ShaderSurface } from "@/visualizer/shaders/ShaderSurface";

import type { VisualizerComponentProps, VisualizerPresetDefinition } from "./types";

const AURORA_SHADER = `
uniform float2 u_resolution;
uniform float u_time;
uniform float u_amplitude;
uniform int u_binCount;
uniform float u_bins[128];

const float PI = 3.14159265359;

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

float averageEnergy() {
    if (u_binCount <= 0) {
        return 0.0;
    }
    int samples = u_binCount < 64 ? u_binCount : 64;
    float sum = 0.0;
    for (int i = 0; i < 64; ++i) {
        if (i >= samples) {
            break;
        }
        sum += clamp(readBin(i), 0.0, 1.0);
    }
    if (samples <= 0) {
        return 0.0;
    }
    return sum / float(samples);
}

float wrapDistance(float a, float b) {
    float diff = abs(a - b);
    return min(diff, 1.0 - diff);
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

    if (u_binCount <= 0) {
        return half4(0.0, 0.0, 0.0, 1.0);
    }

    float2 centered = (fragCoord - 0.5 * u_resolution) / u_resolution.y;
    float dist = length(centered);
    float angle = atan(centered.y, centered.x);
    float normalizedAngle = fract(angle / (2.0 * PI) + 0.5);

    int binCount = u_binCount > 1 ? u_binCount : 1;
    float binCountF = float(binCount);
    float binWidth = 1.0 / binCountF;
    int binIndex = clampIndex(int(floor(normalizedAngle * binCountF)));

    float level = readBin(binIndex);
    float boosted = clamp(level * (0.85 + u_amplitude * 0.5), 0.0, 1.0);
    float flameStrength = pow(boosted, 0.9);

    float energy = averageEnergy();

    float lane = binCount > 1 ? float(binIndex) / float(binCount - 1) : 0.0;
    float3 gradient = barPalette(lane);
    float3 fireAccent = float3(0.992, 0.612, 0.212);
    gradient = mix(gradient, fireAccent, smoothstep(0.45, 1.0, lane) * 0.45);

    float pulse = clamp(energy * 1.4 + u_amplitude * 0.35, 0.0, 1.3);
    float minInner = 0.16;
    float innerRadius = minInner + pulse * 0.05;
    float maxRadius = innerRadius + 0.28;

    float temporalWarp = sin(u_time * (0.8 + energy * 1.4) + lane * 5.3);
    float flicker = 0.035 * temporalWarp + 0.028 * sin(u_time * (1.6 + lane * 2.2));
    float laneVariation = (0.5 + 0.5 * sin(lane * 24.0 + u_time * 1.2)) * 0.08 - 0.04;
    float flameReach = flameStrength + flicker + laneVariation;
    flameReach = clamp(flameReach, 0.0, 1.0);

    float flameCurve = pow(clamp(dist - innerRadius, 0.0, 1.0), 0.65);
    float curvedReach = innerRadius + (maxRadius - innerRadius) * clamp(flameReach, 0.0, 1.0);

    float radiusOuter = curvedReach;
    float radiusInner = innerRadius;
    float radialFill = 1.0 - smoothstep(curvedReach, curvedReach + 0.04, dist);
    float innerMask = 1.0 - smoothstep(radiusInner - 0.01, radiusInner + 0.01, dist);
    float coreMask = smoothstep(innerRadius, innerRadius - 0.022, dist);

    float binStart = float(binIndex) / binCountF;
    float binEnd = float(binIndex + 1) / binCountF;
    float binCenter = (binStart + binEnd) * 0.5;
    float usableWidth = binWidth * mix(0.58, 0.9, clamp(flameStrength, 0.0, 1.0));
    float angleDelta = wrapDistance(normalizedAngle, binCenter);
    float angularMask = smoothstep(usableWidth * 0.5, usableWidth * 0.48, angleDelta);

    float flameMask = radialFill * angularMask * innerMask;
    float embers = smoothstep(curvedReach + 0.04, curvedReach - 0.02, dist) * angularMask;

    float3 baseColor = float3(0.01, 0.015, 0.04);
    float vignette = 1.0 - smoothstep(maxRadius, maxRadius + 0.25, dist);
    baseColor *= vignette;

    float laneNoise = 0.5 + 0.5 * sin(lane * 28.0 + u_time * 2.4);
    float radialNoise = 0.5 + 0.5 * sin((dist - innerRadius) * 36.0 - u_time * 1.8);
    float flameNoise = mix(laneNoise, radialNoise, 0.5) * (0.65 + flameStrength * 0.35);
    flameNoise = pow(clamp(flameNoise, 0.0, 1.2), 1.45);
    float flameFeather = mix(0.58, 0.18, clamp(flameStrength, 0.0, 1.0));
    float noiseMask = smoothstep(flameFeather, 1.0, flameNoise + flameStrength * 0.32);
    flameMask *= noiseMask;

    float3 flameColor = mix(gradient, float3(1.0, 0.9, 0.6), clamp(flameStrength * 0.6, 0.0, 1.0));
    float3 glowColor = mix(flameColor, float3(1.0), 0.35);

    float3 color = baseColor;
    color = mix(color, flameColor, flameMask);
    color += glowColor * embers * 0.5;
    float3 coreColor = float3(0.0, 0.0, 0.0);
    color = mix(color, coreColor, coreMask);

    color = clamp(color, 0.0, 1.0);
    return half4(color, 1.0);
}
`;

const AURORA_DEFINITION: ShaderDefinition = {
    shader: AURORA_SHADER,
    audioConfig: {
        binCount: 96,
        smoothing: 0.55,
        throttleMs: 18,
    },
};

const AuroraVisualizer = ({ style, binCountOverride }: VisualizerComponentProps) => (
    <ShaderSurface definition={AURORA_DEFINITION} style={style} binCountOverride={binCountOverride} />
);

export const auroraPreset: VisualizerPresetDefinition = {
    id: "aurora",
    name: "Aurora",
    Component: AuroraVisualizer,
};
