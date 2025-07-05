import { isObject } from "@legendapp/state";

export function removeNullUndefined<T extends Record<string, any>>(a: T, recursive?: boolean): T {
    // @ts-ignore
    const out: T = {};
    const keys = Object.keys(a);
    for (const key of keys) {
        if (a[key] !== null && a[key] !== undefined) {
            // @ts-ignore
            out[key] = recursive && isObject(a[key]) ? removeNullUndefined(a[key]) : a[key];
        }
    }

    return out;
}

export const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (isToday) {
        // Format as relative time if today
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const hoursAgo = now.getHours() - hours;
        const minutesAgo = now.getMinutes() - minutes;

        if (hoursAgo > 0) {
            return `${hoursAgo} ${hoursAgo === 1 ? "hour" : "hours"} ago`;
        }
        if (minutesAgo > 0) {
            return `${minutesAgo} ${minutesAgo === 1 ? "minute" : "minutes"} ago`;
        }
        return "just now";
    }
    // Format as relative date if not today
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
        return "yesterday";
    }
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });
};

/**
 * Decodes unicode escape sequences and HTML entities in text
 * Handles cases like \u0026 -> & and &amp; -> &
 */
export function decodeTextEntities(text: string): string {
    if (!text || typeof text !== 'string') {
        return text || '';
    }

    let decoded = text;

    try {
        // Decode unicode escape sequences like \u0026
        decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
            return String.fromCharCode(parseInt(code, 16));
        });

        // Decode common HTML entities
        const htmlEntities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#x27;': "'",
            '&#x2F;': '/',
            '&#39;': "'",
            '&apos;': "'",
            '&nbsp;': ' ',
        };

        for (const [entity, replacement] of Object.entries(htmlEntities)) {
            decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
        }

        // Decode numeric HTML entities like &#38; or &#x26;
        decoded = decoded.replace(/&#(\d+);/g, (match, code) => {
            return String.fromCharCode(parseInt(code, 10));
        });

        decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
            return String.fromCharCode(parseInt(code, 16));
        });

    } catch (error) {
        console.warn('Failed to decode text entities:', error);
        return text; // Return original text if decoding fails
    }

    return decoded;
}
