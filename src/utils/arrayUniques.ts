export function arrayUniques<T>(array: T[]): T[] {
    return [...new Set(array)];
}
