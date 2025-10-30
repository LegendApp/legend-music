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

int wrapIndex(int value) {
    if (u_binCount <= 0) {
        return 0;
    }
    int maxIndex = u_binCount - 1;
    if (maxIndex > 127) {
        maxIndex = 127;
    }
    int size = maxIndex + 1;
    if (size <= 0) {
        return 0;
    }
    int quotient = value / size;
    int wrapped = value - quotient * size;
    if (wrapped < 0) {
        wrapped += size;
    }
    return wrapped;
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

float3 ringPalette(float t) {
    float angle = t * (2.0 * PI);
    float3 color = float3(
        0.62 + 0.38 * sin(angle + 0.0),
        0.48 + 0.42 * sin(angle + 2.1),
        0.35 + 0.5 * sin(angle + 4.2)
    );
    return clamp(color, 0.0, 1.0);
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

float fbm(float2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; ++i) {
        value += amplitude * noise(p);
        p *= 2.05;
        amplitude *= 0.5;
    }
    return value;
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
    float binCoordinate = normalizedAngle * binCountF;
    float binMix = fract(binCoordinate);
    int index0 = wrapIndex(int(floor(binCoordinate)));
    int index1 = wrapIndex(index0 + 1);
    int indexNeg1 = wrapIndex(index0 - 1);
    int index2 = wrapIndex(index0 + 2);
    int indexNeg2 = wrapIndex(index0 - 2);

    float weightNeg2 = (1.0 - binMix) * (1.0 - binMix) * 0.05;
    float weightNeg1 = (1.0 - binMix) * 0.3;
    float weight0 = 0.35;
    float weight1 = binMix * 0.3;
    float weight2 = binMix * binMix * 0.05;

    float sumWeights = weightNeg2 + weightNeg1 + weight0 + weight1 + weight2;
    if (sumWeights <= 0.0) {
        sumWeights = 1.0;
    }

    float audioLevel = (
        readBin(indexNeg2) * weightNeg2 +
        readBin(indexNeg1) * weightNeg1 +
        readBin(index0) * weight0 +
        readBin(index1) * weight1 +
        readBin(index2) * weight2
    ) / sumWeights;
    audioLevel = clamp(audioLevel, 0.0, 1.0);
    float boosted = clamp(audioLevel * (0.95 + u_amplitude * 0.55), 0.0, 1.15);
    float flameStrength = pow(boosted, 0.9);

    float energy = averageEnergy();
    float amplitude = clamp(u_amplitude * 0.65 + energy * 0.6, 0.0, 1.6);

    float lane = normalizedAngle;
    float3 gradient = ringPalette(lane);
    float accentWave = 0.5 + 0.5 * sin((lane + audioLevel * 0.15) * (2.0 * PI));
    float3 fireAccent = float3(0.98, 0.74, 0.32);
    gradient = mix(gradient, fireAccent, pow(accentWave, 2.0) * 0.35);

    float baseRadius = 0.24 + amplitude * 0.08;
    float outerRadius = baseRadius + 0.28 + flameStrength * 0.15;

    float radial = dist - baseRadius;
    float radialAbs = abs(radial);

    float2 flowUV = float2(normalizedAngle * 8.0, u_time * 0.55 + amplitude * 0.1);
    float flowNoise = fbm(flowUV);
    float detailNoise = fbm(float2(normalizedAngle * 28.0, radial * 18.0 - u_time * 1.35));
    float swirlNoise = fbm(centered * 3.1 + float2(0.0, u_time * 0.35));
    float combinedNoise = clamp(flowNoise * 0.6 + detailNoise * 0.5 + swirlNoise * 0.25, 0.0, 1.4);
    combinedNoise = clamp(combinedNoise, 0.0, 1.0);

    float flameThickness = 0.045 + amplitude * 0.09 + flameStrength * 0.24;
    float dynamicThickness = flameThickness * (0.8 + combinedNoise * 0.7);
    float flameMask = clamp(1.0 - radialAbs / max(dynamicThickness, 0.0005), 0.0, 1.0);
    flameMask = pow(flameMask, 1.55);

    float baseRing = smoothstep(dynamicThickness * 0.85, dynamicThickness * 0.18, radialAbs);
    float outerGlow = 0.02;
    float coreShadowMask = smoothstep(baseRadius - 0.02, baseRadius - 0.06, dist);

    float3 baseColor = float3(0.01, 0.01, 0.03);
    float3 emberColor = mix(gradient, float3(1.0, 0.46, 0.12), combinedNoise * 0.4 + flameMask * 0.4);
    float3 hotColor = float3(1.0, 0.94, 0.78);

    float3 color = baseColor;
    color = mix(color, emberColor, clamp(baseRing + flameMask, 0.0, 1.0));
    color += hotColor * pow(flameMask, 2.2) * 0.7;
    color += emberColor * outerGlow;

    float sparkNoise = fbm(float2(normalizedAngle * 54.0, u_time * 3.2 - radial * 26.0));
    float sparks = pow(max(sparkNoise - 0.62, 0.0), 4.2) * clamp(audioLevel * 1.3 + amplitude * 0.35, 0.0, 1.0);
    color += sparks * float3(1.0, 0.88, 0.64);

    float3 shadowColor = float3(0.02, 0.02, 0.05);
    color = mix(color, shadowColor, coreShadowMask * (1.0 - flameMask));

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
