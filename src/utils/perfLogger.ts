// Basic instrumentation helpers to make it easy to trace CPU hotspots.
// Enable/disable globally by setting `globalThis.__LEGEND_PERF_LOG__` at runtime.

declare global {
    // eslint-disable-next-line no-var
    var __LEGEND_PERF_LOG__: boolean | undefined;
    // eslint-disable-next-line no-var
    var __LEGEND_PERF_LAST_MARKS__: Record<string, number> | undefined;
    // eslint-disable-next-line no-var
    var __LEGEND_PERF_START__: number | undefined;
}

globalThis.__LEGEND_PERF_LOG__ = true;

const lastMarks = globalThis.__LEGEND_PERF_LAST_MARKS__ ?? {};
globalThis.__LEGEND_PERF_LAST_MARKS__ = lastMarks;
const startTime = globalThis.__LEGEND_PERF_START__ ?? Date.now();
globalThis.__LEGEND_PERF_START__ = startTime;

export const isPerfLoggingEnabled = (): boolean =>
    typeof globalThis.__LEGEND_PERF_LOG__ === "boolean" ? Boolean(globalThis.__LEGEND_PERF_LOG__) : false;

export function perfLog(label: string, ...args: unknown[]): void {
    if (!isPerfLoggingEnabled()) return;
    console.log(`${Math.round(performance.now())} [PERF:${label}]`, ...args);
}

export function perfMark(label: string, data?: Record<string, unknown>): number | undefined {
    if (!isPerfLoggingEnabled()) return undefined;
    const now = Date.now();
    const last = lastMarks[label];
    lastMarks[label] = now;

    const payload: Record<string, unknown> = {
        ...data,
    };

    if (startTime) {
        payload.sinceStartMs = now - startTime;
    }
    if (typeof last === "number") {
        payload.sinceLastMs = now - last;
    }

    console.log(`[PERF:${label}]`, payload);
    return now;
}

export function perfCount(label: string): void {
    if (!isPerfLoggingEnabled()) return;
    console.count(`[PERF:${label}]`);
}

export function perfDelta(label: string): number | undefined {
    if (!isPerfLoggingEnabled()) return undefined;
    const now = Date.now();
    const last = lastMarks[label];
    lastMarks[label] = now;
    return typeof last === "number" ? now - last : undefined;
}

export function perfTime<T>(label: string, fn: () => T): T;
export function perfTime<T>(label: string, fn: () => Promise<T>): Promise<T>;
export function perfTime<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    if (!isPerfLoggingEnabled()) {
        return fn();
    }

    const start = Date.now();
    try {
        const result = fn();

        if (result instanceof Promise) {
            return result.finally(() => {
                const duration = Date.now() - start;
                console.log(`[PERF:${label}] duration=${duration}ms`);
            }) as Promise<T>;
        }

        const duration = Date.now() - start;
        console.log(`[PERF:${label}] duration=${duration}ms`);
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        console.log(`[PERF:${label}] duration=${duration}ms (error)`);
        throw error;
    }
}
