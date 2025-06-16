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
