import type { VisualizerFrame } from "@/native-modules/AudioPlayer";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = new Uint8Array(256).fill(255);

for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
    BASE64_LOOKUP[BASE64_ALPHABET.charCodeAt(index)] = index;
}
BASE64_LOOKUP["=".charCodeAt(0)] = 0;

const EMPTY_FLOAT32 = new Float32Array(0);

const isWhitespace = (charCode: number) =>
    charCode === 0x20 || charCode === 0x0a || charCode === 0x0d || charCode === 0x09;

const decodeBase64Into = (input: string, target: Uint8Array): number => {
    let buffer = 0;
    let bits = 0;
    let outIndex = 0;

    for (let i = 0; i < input.length; i += 1) {
        const code = input.charCodeAt(i);
        if (code === 61 /* '=' */) {
            break;
        }

        const value = BASE64_LOOKUP[code];
        if (value === 255) {
            if (isWhitespace(code)) {
                continue;
            }
            // Skip unsupported characters silently.
            continue;
        }

        buffer = (buffer << 6) | value;
        bits += 6;

        if (bits >= 8) {
            bits -= 8;
            if (outIndex < target.length) {
                target[outIndex] = (buffer >> bits) & 0xff;
            }
            outIndex += 1;
        }
    }

    return outIndex;
};

export const decodeVisualizerBins = (() => {
    let byteScratch = new Uint8Array(0);
    let floatScratch = new Float32Array(0);
    let legacyScratch = new Float32Array(0);

    const ensureByteCapacity = (requiredBytes: number) => {
        if (byteScratch.length < requiredBytes) {
            byteScratch = new Uint8Array(requiredBytes);
            floatScratch = new Float32Array(byteScratch.buffer);
        }
        return byteScratch;
    };

    return (frame: VisualizerFrame): Float32Array => {
        const { payload, format, stride = 4, binCount = 0 } = frame;

        if (typeof payload === "string" && format === "f32-le" && stride === 4 && binCount > 0) {
            const byteTarget = ensureByteCapacity(binCount * stride);
            const written = decodeBase64Into(payload, byteTarget);
            const usableBytes = Math.min(written, binCount * stride);
            const sampleCount = Math.min(binCount, Math.floor(usableBytes / stride));

            if (sampleCount > 0) {
                if (floatScratch.buffer !== byteTarget.buffer) {
                    floatScratch = new Float32Array(byteTarget.buffer);
                }
                return floatScratch.subarray(0, sampleCount);
            }
        }

        if (Array.isArray(frame.bins) && frame.bins.length > 0) {
            const legacyBins = frame.bins;
            if (legacyScratch.length < legacyBins.length) {
                legacyScratch = new Float32Array(legacyBins.length);
            }
            for (let i = 0; i < legacyBins.length; i += 1) {
                legacyScratch[i] = legacyBins[i] ?? 0;
            }
            return legacyScratch.subarray(0, legacyBins.length);
        }

        return EMPTY_FLOAT32;
    };
})();
