// Inspired by "Sunset" — https://www.shadertoy.com/view/tsScRK

import { type ShaderDefinition, ShaderSurface } from "@/visualizer/shaders/ShaderSurface";

import type { VisualizerComponentProps, VisualizerPresetDefinition } from "./types";

const SUNSET_SHADER = `
uniform float2 u_resolution;
uniform float u_time;
uniform float u_amplitude;
uniform int u_binCount;
uniform float u_bins[128];

const float SPEED = 10.0;
const bool USE_WAVE_THING = true;
const bool VAPORWAVE = true;
const float AUDIO_VIBRATION_AMPLITUDE = 0.125;
const int AA = 1;

float jTime;
float gAudioAmplitude = 0.0;
float gAudioEnergy = 0.0;
float gAudioBass = 0.0;
float gAudioTreble = 0.0;

float4 textureMirror(float2 c) {
    return float4(0.0);
}

float clampUnit(float value) {
    return clamp(value, 0.0, 1.0);
}

int clampIndex(int value) {
    int maxIndex = u_binCount - 1;
    if (maxIndex < 0) {
        return 0;
    }
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

    float value = 0.0;
    for (int i = 0; i < 128; ++i) {
        if (i == target) {
            value = u_bins[i];
        }
    }
    return value;
}

float sampleBin(int index) {
    if (u_binCount <= 0) {
        return 0.0;
    }
    int clamped = clampIndex(index);
    return clampUnit(readBin(clamped));
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
    float left = clampUnit(readBin(clampIndex(index)));
    float right = clampUnit(readBin(clampIndex(nextIndex)));
    return mix(left, right, mixAmount);
}

float amp(float2 p) {
    return smoothstep(1.0, 8.0, abs(p.x));
}

float pow512(float a) {
    a *= a;
    a *= a;
    a *= a;
    a *= a;
    a *= a;
    a *= a;
    a *= a;
    a *= a;
    return a * a;
}

float pow1d5(float a) {
    return a * sqrt(a);
}

float hash21(float2 co) {
    return fract(sin(dot(co, float2(1.9898, 7.233))) * 45758.5433);
}

float hash(float2 uv) {
    float a = amp(uv);
    float modulation = 0.0;
    if (USE_WAVE_THING) {
        if (a > 0.0) {
            float wave = sin((0.02 * (uv.y + 0.5 * uv.x) - jTime) * 2.0);
            modulation = 1.0 - 0.4 * pow512(0.51 + 0.49 * wave);
        }
    } else {
        modulation = 1.0;
    }

    float result = 0.0;
    if (a > 0.0) {
        float base = hash21(uv);
        float audioInfluence = 1.0 + gAudioEnergy * 0.4 + gAudioBass * 0.25;
        float modulated = USE_WAVE_THING ? modulation * audioInfluence : 1.0;
        result = a * pow1d5(base) * modulated;
    }

    float audioVibration = AUDIO_VIBRATION_AMPLITUDE * (0.5 + 0.5 * gAudioAmplitude);
    result -= textureMirror(float2((uv.x * 29.0 + uv.y) * 0.03125, 1.0)).x * audioVibration;
    return result;
}

float edgeMin(float dx, float2 da, float2 db, float2 uv) {
    uv.x += 5.0;
    float3 cell = float3(uv, uv.x + uv.y);
    float3 rounded = floor(cell + 0.5);
    float3 c = fract(rounded * (float3(0.0, 1.0, 2.0) + 0.61803398875));
    float a1 = textureMirror(float2(c.y, 0.0)).x > 0.6 ? 0.15 : 1.0;
    float a2 = textureMirror(float2(c.x, 0.0)).x > 0.6 ? 0.15 : 1.0;
    float a3 = textureMirror(float2(c.z, 0.0)).x > 0.6 ? 0.15 : 1.0;

    float edgeA = da.y * a1;
    float edgeB = da.x * a2;
    float edgeC = (1.0 - dx) * db.y * a3;
    return min(min(edgeC, edgeB), edgeA);
}

float2 trinoise(float2 uv) {
    const float SQ = sqrt(3.0 / 2.0);
    uv.x *= SQ;
    uv.y -= 0.5 * uv.x;
    float2 d = fract(uv);
    uv -= d;

    float2 ones = float2(1.0, 1.0);
    bool corner = dot(d, ones) > 1.0;

    float2 dd = 1.0 - d;
    float2 da = corner ? dd : d;
    float2 db = corner ? d : dd;

    float cornerScalar = corner ? 1.0 : 0.0;
    float2 cornerOffset = float2(cornerScalar, cornerScalar);
    float nn = hash(uv + cornerOffset);
    float n2 = hash(uv + float2(1.0, 0.0));
    float n3 = hash(uv + float2(0.0, 1.0));

    float nmid = mix(n2, n3, d.y);
    float ns = mix(nn, corner ? n2 : n3, da.y);
    float dx = da.x / db.y;
    return float2(mix(ns, nmid, dx), edgeMin(dx, da, db, uv + d));
}

float2 map(float3 p) {
    float2 n = trinoise(p.xz);
    return float2(p.y - 2.0 * n.x, n.y);
}

float3 grad(float3 p) {
    const float2 e = float2(0.005, 0.0);
    float a = map(p).x;
    float3 gx = float3(e.x, e.y, e.y);
    float3 gy = float3(e.y, e.x, e.y);
    float3 gz = float3(e.y, e.y, e.x);
    return float3(
        map(p + gx).x - a,
        map(p + gy).x - a,
        map(p + gz).x - a
    ) / e.x;
}

float2 intersect(float3 ro, float3 rd) {
    float d = 0.0;
    float h = 0.0;
    for (int i = 0; i < 500; ++i) {
        float3 p = ro + d * rd;
        float2 s = map(p);
        h = s.x;
        d += h * 0.5;
        if (abs(h) < 0.003 * d) {
            return float2(d, s.y);
        }
        if (d > 150.0 || p.y > 2.0) {
            break;
        }
    }
    return float2(-1.0, -1.0);
}

void addsun(float3 rd, float3 ld, inout float3 col) {
    float sun = smoothstep(0.21, 0.2, distance(rd, ld));
    if (sun > 0.0) {
        float yd = rd.y - ld.y;
        float a = sin(3.1 * exp(-(yd) * 14.0));
        sun *= smoothstep(-0.8, 0.0, a);
        col = mix(col, float3(1.0, 0.8, 0.4) * 0.75, sun);
    }
}

float starnoise(float3 rd) {
    float c = 0.0;
    float3 p = normalize(rd) * 300.0;
    const float3x3 ROT = float3x3(
        3.0 / 5.0, 0.0, 4.0 / 5.0,
        0.0, 1.0, 0.0,
        -4.0 / 5.0, 0.0, 3.0 / 5.0
    );
    for (int i = 0; i < 4; ++i) {
        float3 q = fract(p) - 0.5;
        float3 id = floor(p);
        float c2 = smoothstep(0.5, 0.0, length(q));
        float denom = id.y != 0.0 ? id.y : 1.0;
        c2 *= step(hash21(id.xz / denom), 0.06 - float(i) * float(i) * 0.005);
        c += c2;
        p = p * 0.6 + 0.5 * (ROT * p);
    }
    c *= c;
    float g = dot(sin(rd * 10.512), cos(rd.yzx * 10.512));
    float envelope = smoothstep(-3.14, -0.9, g) * 0.5 + 0.5 * smoothstep(-0.3, 1.0, g);
    return c * c * envelope;
}

float3 gsky(float3 rd, float3 ld, bool mask) {
    float haze = exp2(-5.0 * (abs(rd.y) - 0.2 * dot(rd, ld)));
    float starField = mask ? starnoise(rd) * (1.0 - min(haze, 1.0)) : 0.0;
    float3 back = float3(0.4, 0.1, 0.7) * (1.0 - 0.5 * textureMirror(float2(0.5 + 0.05 * rd.x / rd.y, 0.0)).x * exp2(-0.1 * abs(length(rd.xz) / rd.y)) * max(sign(rd.y), 0.0));
    float3 col = clamp(mix(back, float3(0.7, 0.1, 0.4), haze) + starField, 0.0, 1.0);
    if (mask) {
        addsun(rd, ld, col);
    }
    return col;
}

half4 main(float2 fragCoord) {
    if (u_resolution.x <= 0.0 || u_resolution.y <= 0.0) {
        return half4(0.0, 0.0, 0.0, 1.0);
    }

    float2 resolution = u_resolution;
    float iTime = u_time;
    float iTimeDelta = 1.0 / 60.0;

    float amplitude = clampUnit(u_amplitude * 3.5);
    float bassBin = sampleBinNormalized(0.08);
    float midBin = sampleBinNormalized(0.32);
    float trebleBin = sampleBinNormalized(0.68);
    float energy = clampUnit(bassBin * 0.55 + midBin * 0.3 + trebleBin * 0.15);

    float4 accumulated = float4(0.0);
    for (int xi = 0; xi < AA; ++xi) {
        for (int yi = 0; yi < AA; ++yi) {
            float2 offset = float2(0.0, 0.0);
            if (AA > 1) {
                offset = float2(float(xi), float(yi)) / float(AA);
            }

            float2 sampleCoord = fragCoord + offset;
            sampleCoord.y = resolution.y - sampleCoord.y;
            float2 uv = (2.0 * sampleCoord - resolution) / resolution.y;
            const float shutterSpeed = 0.25;
            float2 jitterCoord = sampleCoord * float(AA);
            float dt = fract(hash21(jitterCoord) + iTime) * shutterSpeed;
            jTime = mod(iTime - dt * iTimeDelta, 4000.0);

            float3 ro = float3(0.0, 1.0, -20000.0 + jTime * SPEED);
            float3 rd = normalize(float3(uv, 4.0 / 3.0));

            float2 intersection = intersect(ro, rd);
            float d = intersection.x;
            float3 ld = normalize(float3(0.0, 0.125 + 0.05 * sin(0.1 * jTime), 1.0));

            float3 fog = d > 0.0 ? exp2(-d * float3(0.14, 0.1, 0.28)) : float3(0.0);
            float3 sky = gsky(rd, ld, d < 0.0);

            float3 p = ro + d * rd;
            float3 n = normalize(grad(p));

            float diff = dot(n, ld) + 0.1 * n.y;
            float3 col = float3(0.1, 0.11, 0.18) * diff;

            float3 rfd = reflect(rd, n);
            float3 rfcol = gsky(rfd, ld, true);

            float fresnel = 0.05 + 0.95 * pow(max(1.0 + dot(rd, n), 0.0), 5.0);
            col = mix(col, rfcol, fresnel);

            if (VAPORWAVE) {
                col = mix(col, float3(0.4, 0.5, 1.0), smoothstep(0.05, 0.0, intersection.y));
                col = mix(sky, col, fog);
                col = sqrt(col);
            } else {
                col = mix(col, float3(0.8, 0.1, 0.92), smoothstep(0.05, 0.0, intersection.y));
                col = mix(sky, col, fog);
            }

            if (d < 0.0) {
                d = 1e6;
            }
            d = min(d, 10.0);

            float3 finalColor = clamp(col, 0.0, 1.0);
            float alpha = 0.1 + exp2(-d);
            accumulated += float4(finalColor, alpha);
        }
    }

    float factor = 1.0 / float(AA * AA);
    float4 averaged = accumulated * factor;
    return half4(averaged.xyz, averaged.w);
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
