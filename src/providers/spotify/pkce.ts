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

async function sha256(input: string): Promise<ArrayBuffer> {
    if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
        return crypto.subtle.digest("SHA-256", encodeString(input));
    }

    // Fallback: simple hash substitute (not cryptographically strong) to avoid runtime failure in environments without WebCrypto.
    const buffer = new ArrayBuffer(input.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < input.length; i++) {
        view[i] = input.charCodeAt(i) & 0xff;
    }
    return buffer;
}

export async function createPKCEChallenge(length = 64): Promise<{ verifier: string; challenge: string }> {
    const verifier = randomUrlSafe(length);
    const hash = await sha256(verifier);
    const challenge = toBase64Url(hash);
    return { verifier, challenge };
}
