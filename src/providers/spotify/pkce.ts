const BASE64_URL_SAFE = /[+/=]/g;

const toBase64Url = (input: ArrayBuffer): string => {
    const bytes = new Uint8Array(input);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    // btoa is available in React Native; if not, fallback to Buffer
    const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
    return base64.replace(BASE64_URL_SAFE, (match) => {
        switch (match) {
            case "+":
                return "-";
            case "/":
                return "_";
            case "=":
                return "";
            default:
                return match;
        }
    });
};

const encodeString = (value: string): Uint8Array => {
    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(value);
    }
    // Simple polyfill
    const utf8: number[] = [];
    for (let i = 0; i < value.length; i++) {
        let charCode = value.charCodeAt(i);
        if (charCode < 0x80) {
            utf8.push(charCode);
        } else if (charCode < 0x800) {
            utf8.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
        } else if ((charCode & 0xfc00) === 0xd800 && i + 1 < value.length) {
            const surrogatePair = 0x10000 + (((charCode & 0x3ff) << 10) | (value.charCodeAt(++i) & 0x3ff));
            utf8.push(
                0xf0 | (surrogatePair >> 18),
                0x80 | ((surrogatePair >> 12) & 0x3f),
                0x80 | ((surrogatePair >> 6) & 0x3f),
                0x80 | (surrogatePair & 0x3f),
            );
        } else {
            utf8.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
        }
    }
    return new Uint8Array(utf8);
};

const randomUrlSafe = (length: number): string => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let result = "";
    for (let i = 0; i < length; i++) {
        const index = Math.floor(Math.random() * alphabet.length);
        result += alphabet[index];
    }
    return result;
};

const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const SHA256_INITIAL = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const rotr = (value: number, shift: number): number => (value >>> shift) | (value << (32 - shift));
const ch = (x: number, y: number, z: number): number => (x & y) ^ (~x & z);
const maj = (x: number, y: number, z: number): number => (x & y) ^ (x & z) ^ (y & z);
const bigSigma0 = (x: number): number => rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22);
const bigSigma1 = (x: number): number => rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);
const smallSigma0 = (x: number): number => rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
const smallSigma1 = (x: number): number => rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10);

const sha256Fallback = (input: string): ArrayBuffer => {
    const bytes = encodeString(input);
    const bitLength = bytes.length * 8;
    let paddedLength = bytes.length + 1;
    while (paddedLength % 64 !== 56) {
        paddedLength += 1;
    }
    const totalLength = paddedLength + 8;
    const buffer = new Uint8Array(totalLength);
    buffer.set(bytes);
    buffer[bytes.length] = 0x80;
    const view = new DataView(buffer.buffer);
    view.setUint32(totalLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
    view.setUint32(totalLength - 4, bitLength >>> 0, false);

    const state = SHA256_INITIAL.slice();
    const message = new Uint32Array(64);

    for (let offset = 0; offset < buffer.length; offset += 64) {
        for (let i = 0; i < 16; i += 1) {
            message[i] = view.getUint32(offset + i * 4, false);
        }
        for (let i = 16; i < 64; i += 1) {
            message[i] =
                (smallSigma1(message[i - 2]) + message[i - 7] + smallSigma0(message[i - 15]) + message[i - 16]) >>> 0;
        }

        let a = state[0];
        let b = state[1];
        let c = state[2];
        let d = state[3];
        let e = state[4];
        let f = state[5];
        let g = state[6];
        let h = state[7];

        for (let i = 0; i < 64; i += 1) {
            const t1 = (h + bigSigma1(e) + ch(e, f, g) + SHA256_K[i] + message[i]) >>> 0;
            const t2 = (bigSigma0(a) + maj(a, b, c)) >>> 0;
            h = g;
            g = f;
            f = e;
            e = (d + t1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) >>> 0;
        }

        state[0] = (state[0] + a) >>> 0;
        state[1] = (state[1] + b) >>> 0;
        state[2] = (state[2] + c) >>> 0;
        state[3] = (state[3] + d) >>> 0;
        state[4] = (state[4] + e) >>> 0;
        state[5] = (state[5] + f) >>> 0;
        state[6] = (state[6] + g) >>> 0;
        state[7] = (state[7] + h) >>> 0;
    }

    const digest = new Uint8Array(32);
    const digestView = new DataView(digest.buffer);
    for (let i = 0; i < state.length; i += 1) {
        digestView.setUint32(i * 4, state[i], false);
    }
    return digest.buffer;
};

async function sha256(input: string): Promise<ArrayBuffer> {
    if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
        return crypto.subtle.digest("SHA-256", encodeString(input));
    }

    return sha256Fallback(input);
}

export async function createPKCEChallenge(length = 64): Promise<{ verifier: string; challenge: string }> {
    const verifier = randomUrlSafe(length);
    const hash = await sha256(verifier);
    const challenge = toBase64Url(hash);
    return { verifier, challenge };
}
