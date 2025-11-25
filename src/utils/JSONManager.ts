import { type Observable, observable } from "@legendapp/state";
import { type SyncTransform, synced } from "@legendapp/state/sync";

import { type ExpoFSPersistPluginOptions, observablePersistExpoFS } from "@/utils/ExpoFSPersistPlugin";

/**
 * Creates a manager for a JSON file with observable state
 * @param filename The name of the JSON file (without path)
 * @param initialValue The initial value for the observable
 * @returns An object with the observable and utility functions
 */
export function createJSONManager<T extends object>(params: {
    basePath?: ExpoFSPersistPluginOptions["basePath"];
    filename: string;
    initialValue: T;
    saveDefaultToFile?: boolean;
    transform?: SyncTransform<any, any>;
    format?: "json";
    preload?: boolean | string[];
    saveTimeout?: number;
}): Observable<T> {
    const {
        basePath,
        filename,
        format = "json",
        preload = [filename],
        initialValue,
        saveDefaultToFile,
        saveTimeout = 300,
        transform,
    } = params;
    const shouldPreload = preload !== false;
    // Create an observable with the initial value and make sure it has the correct type
    const data$ = observable<Record<string, any>>(
        synced({
            initial: initialValue,
            persist: {
                name: filename,
                plugin: observablePersistExpoFS({
                    basePath,
                    preload: preload === false ? undefined : Array.isArray(preload) ? preload : [filename],
                    saveTimeout,
                    format,
                }),
                transform,
            },
        }),
    );

    // Avoid forcing an extra read when preloading is enabled; rely on the persist plugin to load tables.
    if (!shouldPreload) {
        data$.get();
    }

    if (saveDefaultToFile) {
        // TODO: save default to file
        // Need a feature in Legend State first
    }

    return data$ as unknown as Observable<T>;
}
