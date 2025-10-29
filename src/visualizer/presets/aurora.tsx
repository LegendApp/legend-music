// Original shader inspired by polar aurora phenomena and audio-reactive ribbons.

import { type ShaderDefinition, ShaderSurface } from "@/visualizer/shaders/ShaderSurface";

import type { VisualizerComponentProps, VisualizerPresetDefinition } from "./types";

const AURORA_SHADER = `
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
    return value;
}

float sampleBinNormalized(float normalized) {
    if (u_binCount <= 0) {
        return 0.0;
    }

    int lastIndex = u_binCount - 1;
    if (lastIndex < 0) {
        lastIndex = 0;
    }
    float scaled = clamp(normalized, 0.0, 1.0) * float(lastIndex);
    int index = int(floor(scaled));
    int nextIndex = index + 1;
    if (nextIndex > lastIndex) {
        nextIndex = lastIndex;
    }

    float mixAmount = fract(scaled);
    float left = clamp(readBin(clampIndex(index)), 0.0, 1.0);
    float right = clamp(readBin(clampIndex(nextIndex)), 0.0, 1.0);
    return mix(left, right, mixAmount);
}

float sampleRangeNormalized(float start, float end) {
    const int STEPS = 5;
    if (STEPS <= 1) {
        return sampleBinNormalized(start);
    }
    float contribution = 0.0;
    for (int i = 0; i < STEPS; ++i) {
        float t = float(i) / float(STEPS - 1);
        float position = mix(start, end, t);
        contribution += sampleBinNormalized(position);
    }
    return contribution / float(STEPS);
}

float hash12(float2 p) {
    float h = dot(p, float2(127.1, 311.7));
    return fract(sin(h) * 43758.5453);
}

float noise(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);

    float a = hash12(i);
    float b = hash12(i + float2(1.0, 0.0));
    float c = hash12(i + float2(0.0, 1.0));
    float d = hash12(i + float2(1.0, 1.0));

    float2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

half4 main(float2 fragCoord) {
    if (u_resolution.x <= 0.0 || u_resolution.y <= 0.0) {
        return half4(0.0, 0.0, 0.0, 1.0);
    }

    float2 uv = fragCoord / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    float2 centered = float2(uv.x - 0.5, uv.y - 0.5);
    centered.x *= aspect;
    float dist = length(centered);
    float angle = atan(centered.y, centered.x);

    float bass = sampleRangeNormalized(0.0, 0.15);
    float mids = sampleRangeNormalized(0.2, 0.5);
    float highs = sampleRangeNormalized(0.65, 0.95);
    float amplitude = clamp(u_amplitude * 0.8, 0.0, 1.5);
    float energy = clamp(bass * 0.55 + mids * 0.35 + highs * 0.1, 0.0, 1.0);
    float balancedEnergy = mix(energy, mids, 0.35);

    float time = u_time * 0.45;
    float ribbonPhase = angle * (3.6 + 1.4 * balancedEnergy) + time * (0.85 + 1.25 * balancedEnergy);
    float ripplePhase = dist * (10.5 + 5.5 * balancedEnergy) - u_time * (1.4 + bass * 2.0);

    float ribbonWave = sin(ribbonPhase);
    float ribbonMask = smoothstep(0.88 - balancedEnergy * 0.25, 0.18, abs(ribbonWave));
    float ribbonEnergy = ribbonMask * (0.35 + highs * 0.8);

    float radialOffset = 0.06 * sin(dist * 16.0 - u_time * (1.35 + bass * 1.6)) +
        0.035 * sin(angle * 5.0 + time * 1.1);
    float dynamicRadius = dist + radialOffset;
    float radialGlow = exp(-dynamicRadius * dynamicRadius * (5.0 - 3.0 * (bass + amplitude)));

    float ripple = cos(ripplePhase);
    float rippleMask = smoothstep(-0.2, 0.7, ripple) * (0.3 + energy);

    float3 base = float3(0.02, 0.05, 0.12);
    float3 horizon = float3(0.05, 0.45, 0.78);
    float3 aurora = float3(0.45, 0.16, 0.75);
    float3 highlights = float3(0.98, 0.77, 0.35);

    float gradient = 0.5 + 0.5 * sin(angle * 1.2 + time * 0.4 + dist * 2.5);
    float3 auroraColor = mix(horizon, aurora, gradient);
    auroraColor = mix(auroraColor, highlights, pow(highs, 1.5));

    float shimmerNoise = noise(centered * 6.5 + float2(time * 0.25, time * -0.18));
    float shimmer = pow(clamp(shimmerNoise * 1.3 + ripple * 0.2, 0.0, 1.0), 1.4) * (0.2 + highs);

    float sparkNoise = noise(centered * 24.0 + float2(time * 0.1, time * -0.07));
    float sparkle = pow(max(sparkNoise - 0.82, 0.0), 6.0) * (0.2 + highs * 1.8);

    float bands = clamp(ribbonEnergy + rippleMask + radialGlow, 0.0, 2.2);
    float3 color = base + auroraColor * bands;
    color += shimmer * mix(aurora, highlights, highs);
    color += sparkle;

    float vignette = 1.0 - smoothstep(0.35, 0.95, dist);
    color *= vignette * (0.7 + 0.6 * (energy + amplitude));
    color = clamp(color, 0.0, 1.0);
    color = pow(color, float3(0.9, 0.9, 0.9));
    return half4(color, 1.0);
}
`;

const AURORA_DEFINITION: ShaderDefinition = {
    shader: AURORA_SHADER,
    audioConfig: {
        binCount: 96,
        smoothing: 0.6,
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
