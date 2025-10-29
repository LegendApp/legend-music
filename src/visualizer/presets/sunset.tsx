// Inspired by "Sunset" — https://www.shadertoy.com/view/tsScRK

import { ShaderSurface, type ShaderDefinition } from "@/visualizer/shaders/ShaderSurface";

import type { VisualizerComponentProps, VisualizerPresetDefinition } from "./types";

const SUNSET_SHADER = `
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
    return saturate(u_bins[clamped] * 1.4);
}

half4 main(float2 fragCoord) {
    if (u_resolution.x <= 0.0 || u_resolution.y <= 0.0) {
        return half4(0.0, 0.0, 0.0, 1.0);
    }

    float2 uv = fragCoord / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    float2 centered = float2(uv.x * aspect - aspect * 0.5, uv.y - 0.4);

    float amplitude = saturate(u_amplitude * 3.0);
    float bass = sampleBin(0);
    float mid = sampleBin(u_binCount / 3);

    float sunRadius = 0.23;
    float sunCore = smoothstep(sunRadius, 0.0, length(centered));
    float sunGlow = smoothstep(sunRadius * 2.0, 0.0, length(centered));

    float2 waveCoord = float2(uv.x, uv.y);
    float waveEnergy = amplitude * 0.6 + bass * 0.7 + mid * 0.4;
    float wave = sin((waveCoord.x + u_time * 0.12) * 8.0) * 0.02 * (0.6 + waveEnergy);
    float ripple = sin((waveCoord.x * 22.0) + u_time * 5.0) * 0.008 * (0.4 + waveEnergy);
    float waterLine = 0.48 + wave + ripple;

    float3 skyBottom = float3(0.98, 0.43, 0.25);
    float3 skyTop = float3(0.05, 0.02, 0.24);
    float skyMix = smoothstep(0.1, 1.0, uv.y);
    float3 sky = mix(skyBottom, skyTop, pow(skyMix, 1.4));
    sky += float3(1.0, 0.6, 0.3) * sunGlow * 0.6;

    float waterT = clamp((uv.y - waterLine) / (1.0 - waterLine), 0.0, 1.0);
    float3 waterDeep = float3(0.05, 0.08, 0.22);
    float3 waterShallow = float3(0.9, 0.35, 0.35);
    float3 water = mix(waterShallow, waterDeep, pow(waterT, 1.6));
    water += float3(1.0, 0.65, 0.4) * sunGlow * (0.55 + amplitude * 0.5 + bass * 0.4);
    water += float3(0.55, 0.3, 0.2) * smoothstep(0.0, -0.18, waterLine - uv.y);

    float3 gradient = mix(sky, water, step(waterLine, uv.y));

    float2 starCoord = fract(uv * float2(32.0, 20.0) + u_time * 0.03);
    float star = smoothstep(0.06, 0.02, length(starCoord - 0.5));
    float starMask = smoothstep(0.0, 0.25, 0.35 - uv.y);
    gradient += float3(0.9, 0.9, 1.0) * star * starMask * 0.25;

    float3 color = gradient;
    color = mix(color, float3(1.0, 0.78, 0.45), sunCore * (0.85 + amplitude * 0.5));
    color = clamp(color, 0.0, 1.0);

    return half4(color, 1.0);
}
`;

const SUNSET_DEFINITION: ShaderDefinition = {
    shader: SUNSET_SHADER,
    audioConfig: {
        binCount: 80,
        smoothing: 0.65,
        throttleMs: 20,
    },
};

const SunsetVisualizer = ({ style }: VisualizerComponentProps) => (
    <ShaderSurface definition={SUNSET_DEFINITION} style={style} />
);

export const sunsetPreset: VisualizerPresetDefinition = {
    id: "sunset",
    name: "Sunset",
    Component: SunsetVisualizer,
};
