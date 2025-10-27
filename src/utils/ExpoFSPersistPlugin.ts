import type { Change } from "@legendapp/state";
import { applyChanges, internal, isArray } from "@legendapp/state";
import type { ObservablePersistPlugin, ObservablePersistPluginOptions, PersistMetadata } from "@legendapp/state/sync";
import * as FileSystemNext from "expo-file-system/next";
import { Packr } from "msgpackr";
import { ensureCacheDirectory, getCacheDirectory } from "@/utils/cacheDirectories";
import { timeoutOnce } from "@/utils/timeoutOnce";

const MetadataSuffix = "__m";
const { safeParse, safeStringify } = internal;

const packer = new Packr({ bundleStrings: true });

/**
 * Configuration options for the ReactNativeFS plugin
 */
export interface ExpoFSPersistPluginOptions {
    /**
     * Base directory path. Defaults to Cache
     */
    basePath?: "Cache";

    format: "json" | "msgpack" | "m3u";

    /**
     * Preload all tables on startup. Can be true to load all, or an array of table names
     */
    preload?: string[];

    saveTimeout?: number;
}

class ObservablePersistExpoFS implements ObservablePersistPlugin {
    private data: Record<string, any> = {};
    private configuration: ExpoFSPersistPluginOptions;
    private directory: FileSystemNext.Directory;
    private extension: string;

    constructor(configuration: ExpoFSPersistPluginOptions) {
        this.configuration = configuration;
        this.directory = getCacheDirectory("data");
        this.extension = configuration.format === "json" ? "json" : configuration.format === "m3u" ? "m3u" : "lgm";
    }

    public initialize(_configOptions: ObservablePersistPluginOptions) {
        const storageConfig = this.configuration;
        let tables: string[] = [];

        try {
            // Ensure base directory exists
            ensureCacheDirectory(this.directory);

            if (isArray(storageConfig.preload)) {
                // If preloadKeys, preload the tables on startup
                const metadataTables = storageConfig.preload.map((table) =>
                    table.endsWith(MetadataSuffix) ? undefined : table + MetadataSuffix,
                );
                tables = [...storageConfig.preload, ...(metadataTables.filter(Boolean) as string[])];

                // Load all the preload tables
                tables.map((table) => this.loadTable(table));
            }
        } catch (e) {
            console.error("[legend-state] ObservablePersistReacExpoFS failed to initialize", e);
        }
    }

    private readFile(file: FileSystemNext.File) {
        if (this.configuration.format === "json") {
            const content = file.text();
            const parsed = safeParse(content);
            return parsed;
        }
        if (this.configuration.format === "m3u") {
            // For M3U format, just return the plain text content
            return file.text();
        }
        const content = file.bytes();
        return packer.unpack(content);
    }

    public loadTable(table: string) {
        if (this.data[table] === undefined) {
            try {
                const mainTableFile = new FileSystemNext.File(this.directory, `${table}.${this.extension}`);
                const metadataTableFile = new FileSystemNext.File(
                    this.directory,
                    `${table}${MetadataSuffix}.${this.extension}`,
                );

                console.log("read", table);

                if (mainTableFile.exists) {
                    this.data[table] = this.readFile(mainTableFile);
                }

                if (metadataTableFile.exists) {
                    this.data[table + MetadataSuffix] = this.readFile(metadataTableFile);
                }
            } catch (err) {
                console.error("[legend-state] ObservablePersistReacExpoFS failed to load table", table, err);
            }
        }
    }

    // Gets
    public getTable(table: string, init: object) {
        return this.data[table] ?? init ?? {};
    }

    public getMetadata(table: string): PersistMetadata {
        return this.getTable(table + MetadataSuffix, {});
    }

    // Sets
    public set(table: string, changes: Change[]): Promise<void> {
        if (!this.data[table]) {
            this.data[table] = {};
        }

        this.data[table] = applyChanges(this.data[table], changes);
        return this.save(table);
    }

    public setMetadata(table: string, metadata: PersistMetadata) {
        return this.setValue(table + MetadataSuffix, metadata);
    }

    public deleteTable(table: string) {
        const filePath = new FileSystemNext.File(this.directory, table);
        if (filePath.exists) {
            filePath.delete();
        }
        delete this.data[table];
    }

    public deleteMetadata(table: string) {
        return this.deleteTable(table + MetadataSuffix);
    }

    // Private
    private async setValue(table: string, value: any) {
        this.data[table] = value;
        await this.save(table);
    }

    private async save(table: string) {
        console.log("save", table);

        timeoutOnce(`save_${table}`, () => this.saveDebounced(table), this.configuration.saveTimeout || 100);
    }

    private async saveDebounced(table: string) {
        const v = this.data[table];
        const file = new FileSystemNext.File(this.directory, `${table}.${this.extension}`);

        ensureCacheDirectory(file.parentDirectory);

        console.log("save debounced", table);

        if (v !== undefined && v !== null) {
            let out: string | Uint8Array;
            if (this.configuration.format === "json") {
                out = safeStringify(v);
            } else if (this.configuration.format === "m3u") {
                // For M3U format, expect the value to already be a string
                out = typeof v === "string" ? v : String(v);
            } else {
                out = packer.pack(v);
            }
            return file.write(out);
        }

        if (file.exists) {
            return file.delete();
        }

        return Promise.resolve();
    }
}

export function observablePersistExpoFS(configuration: ExpoFSPersistPluginOptions = { format: "json" }) {
    return new ObservablePersistExpoFS(configuration);
}
