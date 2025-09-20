import { observable } from "@legendapp/state";
import { Directory, File } from "expo-file-system/next";
import * as ID3 from "id3js";
import jsmediatags from "jsmediatags/build2/jsmediatags";
import AudioPlayer from "@/native-modules/AudioPlayer";
import { stateSaved$ } from "@/systems/State";
import { ensureCacheDirectory, getCacheDirectory } from "@/utils/cacheDirectories";
import { createJSONManager } from "@/utils/JSONManager";
import { perfCount, perfDelta, perfLog, perfTime } from "@/utils/perfLogger";

export interface LocalTrack {
    id: string;
    title: string;
    artist: string;
    duration: string;
    filePath: string;
    fileName: string;
    thumbnail?: string;
}

export interface LocalMusicSettings {
    libraryPaths: string[];
    autoScanOnStart: boolean;
    lastScanTime: number;
}

export interface LocalMusicState {
    tracks: LocalTrack[];
    isScanning: boolean;
    scanProgress: number;
    scanTotal: number;
    error: string | null;
    isLocalFilesSelected: boolean;
}

// Settings persistence
export const localMusicSettings$ = createJSONManager<LocalMusicSettings>({
    filename: "localMusicSettings",
    initialValue: {
        libraryPaths: ["/Users/jay/Downloads/mp3"],
        autoScanOnStart: true,
        lastScanTime: 0,
    },
});

// Runtime state
export const localMusicState$ = observable<LocalMusicState>({
    tracks: [],
    isScanning: false,
    scanProgress: 0,
    scanTotal: 0,
    error: null,
    isLocalFilesSelected: false,
});

const ARTWORK_CACHE_VERSION = "v2";

type ArtworkBinary = ArrayBuffer | ArrayBufferView;

interface ID3ImageValue {
    type?: string | null;
    mime?: string | null;
    format?: string | null;
    description?: string | null;
    data: ArtworkBinary | number[] | null;
}

function isImageValue(value: unknown): value is ID3ImageValue {
    if (!value || typeof value !== "object" || !("data" in value)) {
        return false;
    }

    const data = (value as { data: unknown }).data;
    if (!data) {
        return false;
    }

    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        return true;
    }

    if (Array.isArray(data)) {
        return data.every((item) => typeof item === "number");
    }

    return false;
}

function getThumbnailCacheKey(input: string): string {
    let hash = 0;
    if (input.length === 0) {
        return hash.toString();
    }

    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Force 32-bit integer
    }

    return Math.abs(hash).toString(16);
}

function getExtensionForMime(mime: string | null): string {
    if (!mime) {
        return "jpg";
    }

    const normalized = mime.toLowerCase();
    if (normalized.includes("png")) {
        return "png";
    }
    if (normalized.includes("webp")) {
        return "webp";
    }
    if (normalized.includes("gif")) {
        return "gif";
    }
    return "jpg";
}

function fileNameFromPath(path: string): string {
    const lastSlash = path.lastIndexOf("/");
    return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

function stripUnsynchronization(data: Uint8Array): Uint8Array {
    let extraZeros = 0;
    for (let i = 0; i < data.length - 1; i++) {
        if (data[i] === 0xff && data[i + 1] === 0x00) {
            extraZeros++;
        }
    }

    if (extraZeros === 0) {
        return data;
    }

    const output = new Uint8Array(data.length - extraZeros);
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < data.length; readIndex++) {
        const value = data[readIndex];
        output[writeIndex++] = value;

        if (value === 0xff && readIndex + 1 < data.length && data[readIndex + 1] === 0x00) {
            readIndex++; // Skip the stuffed 0x00 byte
        }
    }

    if (writeIndex !== output.length) {
        return output.subarray(0, writeIndex);
    }

    return output;
}

function extractEmbeddedArtwork(filePath: string, tags: unknown): string | undefined {
    if (!tags || typeof tags !== "object") {
        return undefined;
    }

    const candidates: unknown[] = [];
    const tagObject = tags as { images?: unknown; picture?: unknown };

    if (Array.isArray(tagObject.images)) {
        candidates.push(...tagObject.images);
    }

    if (tagObject.picture) {
        candidates.push(tagObject.picture);
    }

    if (candidates.length === 0) {
        return undefined;
    }

    const image = candidates.find((candidate): candidate is ID3ImageValue => isImageValue(candidate));
    if (!image || !image.data) {
        return undefined;
    }

    const imageData = image.data;
    let buffer: Uint8Array;

    if (imageData instanceof ArrayBuffer) {
        buffer = new Uint8Array(imageData);
    } else if (ArrayBuffer.isView(imageData)) {
        buffer = new Uint8Array(imageData.buffer, imageData.byteOffset, imageData.byteLength);
    } else if (Array.isArray(imageData)) {
        buffer = Uint8Array.from(imageData);
    } else {
        return undefined;
    }

    if (buffer.byteLength === 0) {
        return undefined;
    }

    const thumbnailsDir = getCacheDirectory("thumbnails");
    ensureCacheDirectory(thumbnailsDir);

    const extension = getExtensionForMime(image.mime ?? image.format ?? null);
    const descriptor =
        (typeof image.type === "string" && image.type) ||
        (typeof image.description === "string" && image.description) ||
        "cover";
    const cacheKey = getThumbnailCacheKey(`${ARTWORK_CACHE_VERSION}:${filePath}:${descriptor}`);

    const looksLikeJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const looksUnsyncedJpeg =
        buffer.length > 4 &&
        buffer[0] === 0xff &&
        buffer[1] === 0x00 &&
        buffer[2] === 0xd8 &&
        (buffer[3] === 0xff || buffer[3] === 0x00);
    if (!looksLikeJpeg && looksUnsyncedJpeg) {
        console.warn(
            `Artwork appears unsynchronized (0xFF00 markers) for ${fileNameFromPath(filePath)}; trying to strip 0x00 stuffing`,
        );
    } else if (!looksLikeJpeg && extension === "jpg") {
        console.warn(
            `Artwork bytes for ${fileNameFromPath(filePath)} do not start with JPEG magic: ${buffer[0]}, ${buffer[1]}, ${buffer[2]}`,
        );
    }
    const variants: Array<{
        suffix: string;
        write: (file: File, data: Uint8Array) => void | Promise<void>;
        description: string;
        prepareBuffer?: () => Uint8Array;
    }> = [
        {
            suffix: "",
            description: "FileHandle.writeBytes direct",
            write: (file, data) => {
                const handle = file.open();
                try {
                    handle.offset = 0;
                    handle.writeBytes(data);
                } finally {
                    handle.close();
                }
            },
        },
        // {
        //     suffix: "-test2",
        //     description: "File.write with shared buffer",
        //     write: (file, data) => {
        //         file.write(data);
        //     },
        // },
        // {
        //     suffix: "-test3",
        //     description: "FileHandle chunked writes",
        //     write: (file, data) => {
        //         const handle = file.open();
        //         try {
        //             handle.offset = 0;
        //             const chunkSize = 64 * 1024;
        //             for (let offset = 0; offset < data.byteLength; offset += chunkSize) {
        //                 const slice = data.subarray(offset, Math.min(offset + chunkSize, data.byteLength));
        //                 handle.writeBytes(slice);
        //             }
        //         } finally {
        //             handle.close();
        //         }
        //     },
        // },
        // {
        //     suffix: "-test4",
        //     description: "File.write with cloned Uint8Array",
        //     prepareBuffer: () => Uint8Array.from(buffer),
        //     write: (file, data) => {
        //         file.write(data);
        //     },
        // },
        // {
        //     suffix: "-test5",
        //     description: "File.write with sliced ArrayBuffer copy",
        //     prepareBuffer: () =>
        //         new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
        //     write: (file, data) => {
        //         file.write(data);
        //     },
        // },
        // {
        //     suffix: "-test6",
        //     description: "WritableStream writer",
        //     write: async (file, data) => {
        //         // Writable API is async, chunk once then close.
        //         const stream = file.writableStream();
        //         const writer = stream.getWriter();
        //         try {
        //             await writer.write(data);
        //         } finally {
        //             await writer.close();
        //         }
        //     },
        // },
        // {
        //     suffix: "-unsync",
        //     description: "Unsynchronization bytes stripped",
        //     prepareBuffer: () => stripUnsynchronization(buffer),
        //     write: (file, data) => {
        //         file.write(data);
        //     },
        // },
        // {
        //     suffix: "-skip4",
        //     description: "Skip first 4 bytes (possible data length indicator)",
        //     prepareBuffer: () => buffer.subarray(4),
        //     write: (file, data) => {
        //         file.write(data);
        //     },
        // },
    ];

    for (const variant of variants) {
        const variantFile = new File(thumbnailsDir, `${cacheKey}${variant.suffix}.${extension}`);
        try {
            variantFile.create({ overwrite: true, intermediates: true });
            const variantBuffer = variant.prepareBuffer ? variant.prepareBuffer() : buffer;
            variant.write(variantFile, variantBuffer);

            try {
                const writtenBytes = variantFile.bytes();
                if (writtenBytes.length !== variantBuffer.length) {
                    console.warn(
                        `Artwork cache mismatch (${variant.suffix || "base"}): length ${writtenBytes.length} !== ${variantBuffer.length}`,
                    );
                } else {
                    let mismatchIndex = -1;
                    for (let i = 0; i < writtenBytes.length; i++) {
                        if (writtenBytes[i] !== variantBuffer[i]) {
                            mismatchIndex = i;
                            break;
                        }
                    }
                    if (mismatchIndex !== -1) {
                        console.warn(
                            `Artwork cache mismatch (${variant.suffix || "base"}) at byte ${mismatchIndex}: wrote ${writtenBytes[mismatchIndex]}, expected ${variantBuffer[mismatchIndex]}`,
                        );
                    } else {
                        console.log(
                            `Artwork cache write succeeded (${variant.suffix || "base"}): ${variant.description} -> ${variantFile.uri}`,
                        );
                    }
                }
            } catch (verifyError) {
                console.warn(
                    `Failed to verify cached album art bytes (${variant.suffix || "base"}) for ${filePath}:`,
                    verifyError,
                );
            }
        } catch (error) {
            console.warn(`Failed to cache album art (${variant.suffix || "base"}) for ${filePath}:`, error);
        }
    }

    return new File(thumbnailsDir, `${cacheKey}.${extension}`).uri;
}

async function extractArtworkWithJsMediaTags(filePath: string): Promise<string | undefined> {
    return new Promise((resolve) => {
        try {
            new jsmediatags.Reader(filePath).setTagsToRead(["picture"]).read({
                onSuccess: (data) => {
                    void (async () => {
                        try {
                            const thumbnail = extractEmbeddedArtwork(filePath, data.tags);
                            resolve(thumbnail);
                        } catch (error) {
                            console.warn(
                                `Failed to cache artwork via jsmediatags for ${fileNameFromPath(filePath)}:`,
                                error,
                            );
                            resolve(undefined);
                        }
                    })();
                },
                onError: (error) => {
                    console.warn(
                        `jsmediatags failed to read artwork for ${fileNameFromPath(filePath)}:`,
                        error?.info ?? error,
                    );
                    resolve(undefined);
                },
            });
        } catch (error) {
            console.warn(`jsmediatags setup failed for ${fileNameFromPath(filePath)}:`, error);
            resolve(undefined);
        }
    });
}

// Extract metadata from ID3 tags with filename fallback
async function extractId3Metadata(
    filePath: string,
    fileName: string,
): Promise<{ title: string; artist: string; duration?: string; thumbnail?: string }> {
    perfCount("LocalMusic.extractId3Metadata");

    const fallback = parseFilenameOnly(fileName);
    let title = fallback.title;
    let artist = fallback.artist;
    let duration: string | undefined;
    let thumbnail: string | undefined;

    try {
        // First try to extract ID3 tags
        const tags = await perfTime("LocalMusic.ID3.fromPath", () => ID3.fromPath(filePath));

        if (tags) {
            title = tags.title || title;
            artist = tags.artist || artist;

            const tagDurationSeconds = parseDurationFromTags(tags);
            if (tagDurationSeconds !== null) {
                duration = formatDuration(tagDurationSeconds);
            }

            // try {
            //     thumbnail = await extractEmbeddedArtwork(filePath, tags);
            // } catch (error) {
            //     console.warn(`Failed to extract artwork from ${fileName}:`, error);
            // }
        }
    } catch (error) {
        console.warn(`Failed to read ID3 tags from ${fileName}:`, error);
    }

    if (!thumbnail) {
        const jsMediaTagsThumbnail = await extractArtworkWithJsMediaTags(filePath);
        if (jsMediaTagsThumbnail) {
            thumbnail = jsMediaTagsThumbnail;
        }
    }

    if (!duration) {
        try {
            const info = await AudioPlayer.getTrackInfo(filePath);
            if (info && typeof info.durationSeconds === "number" && info.durationSeconds > 0) {
                duration = formatDuration(info.durationSeconds);
            }
        } catch (error) {
            console.warn(`Failed to read native metadata from ${fileName}:`, error);
        }
    }

    return {
        title,
        artist,
        duration,
        thumbnail,
    };
}

// Fallback: Extract metadata from filename (original logic)
function parseFilenameOnly(fileName: string): {
    title: string;
    artist: string;
} {
    // Remove extension
    let name = fileName.replace(/\.mp3$/i, "");

    // Decode URL-encoded characters (like %20 for spaces)
    try {
        name = decodeURIComponent(name);
    } catch (error) {
        // If decoding fails, use the original name
        console.warn(`Failed to decode filename: ${fileName}`, error);
    }

    // Try to parse "Artist - Title" format
    if (name.includes(" - ")) {
        const parts = name.split(" - ");
        const artist = parts[0].trim();
        const title = parts.slice(1).join(" - ").trim();
        return {
            title: title,
            artist: artist,
        };
    }

    // If no artist separator, use filename as title
    return {
        title: name.trim(),
        artist: "Unknown Artist",
    };
}

// Format duration from seconds to MM:SS format
function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function parseDurationFromTags(tags: unknown): number | null {
    if (!tags || typeof tags !== "object") {
        return null;
    }

    const durationValue = (tags as { duration?: unknown }).duration;
    if (typeof durationValue === "number" && durationValue > 0) {
        return durationValue;
    }

    const lengthValue = (tags as { length?: unknown }).length;
    if (typeof lengthValue === "number" && lengthValue > 0) {
        return lengthValue / 1000;
    }

    if (typeof lengthValue === "string") {
        const numeric = Number.parseFloat(lengthValue);
        if (!Number.isNaN(numeric) && numeric > 0) {
            // TLEN is defined in milliseconds, but we guard in case the value is already seconds
            return numeric > 3600 ? numeric / 1000 : numeric;
        }
    }

    return null;
}

// Scan directory for MP3 files
async function scanDirectory(directoryPath: string): Promise<LocalTrack[]> {
    const tracks: LocalTrack[] = [];

    try {
        perfLog("LocalMusic.scanDirectory.start", { directoryPath });
        const directory = new Directory(directoryPath);

        if (!directory.exists) {
            console.warn(`Directory does not exist: ${directoryPath}`);
            return tracks;
        }

        const items = perfTime("LocalMusic.Directory.list", () => directory.list());

        for (const item of items) {
            perfCount("LocalMusic.scanDirectory.item");
            if (item instanceof File && item.name.toLowerCase().endsWith(".mp3")) {
                // Decode the filename for the file path
                let decodedFileName = item.name;
                try {
                    decodedFileName = decodeURIComponent(item.name);
                } catch (error) {
                    console.warn(`Failed to decode filename: ${item.name}`, error);
                }

                const filePath = `${directoryPath}/${decodedFileName}`;

                try {
                    const id3Delta = perfDelta("LocalMusic.scanDirectory.id3Loop");
                    perfLog("LocalMusic.scanDirectory.processFile", {
                        filePath,
                        id3Delta,
                    });
                    // Extract metadata from ID3 tags with filename fallback
                    const metadata = await extractId3Metadata(filePath, item.name);

                    const track: LocalTrack = {
                        id: filePath,
                        title: metadata.title,
                        artist: metadata.artist,
                        duration: metadata.duration || "0:00",
                        filePath,
                        fileName: item.name,
                        thumbnail: metadata.thumbnail,
                    };

                    tracks.push(track);
                } catch (error) {
                    console.error(`Failed to process MP3 file ${item.name}:`, error);
                    // Continue with other files
                }
            }
        }

        console.log(`Found ${tracks.length} MP3 files in ${directoryPath}`);
        return tracks;
    } catch (error) {
        console.error(`Error scanning directory ${directoryPath}:`, error);
        throw error;
    }
}

// Scan all configured library paths
export async function scanLocalMusic(): Promise<void> {
    const paths = localMusicSettings$.libraryPaths.get();

    if (paths.length === 0) {
        localMusicState$.error.set("No library paths configured");
        return;
    }

    perfLog("LocalMusic.scanLocalMusic.start", { paths });
    localMusicState$.isScanning.set(true);
    localMusicState$.error.set(null);
    localMusicState$.scanProgress.set(0);
    localMusicState$.scanTotal.set(paths.length);

    const allTracks: LocalTrack[] = [];

    try {
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            console.log(`Scanning directory: ${path}`);

            try {
                const tracks = await perfTime("LocalMusic.scanDirectory.total", () => scanDirectory(path));
                allTracks.push(...tracks);
            } catch (error) {
                console.error(`Failed to scan ${path}:`, error);
                // Continue with other directories
            }

            localMusicState$.scanProgress.set(i + 1);
        }

        // Sort tracks by artist then title
        allTracks.sort((a, b) => {
            const artistCompare = a.artist.localeCompare(b.artist);
            if (artistCompare !== 0) return artistCompare;
            return a.title.localeCompare(b.title);
        });

        perfLog("LocalMusic.scanLocalMusic.done", { total: allTracks.length });
        localMusicState$.tracks.set(allTracks);
        localMusicSettings$.lastScanTime.set(Date.now());

        console.log(`Scan complete: Found ${allTracks.length} total MP3 files`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        localMusicState$.error.set(`Scan failed: ${errorMessage}`);
        console.error("Local music scan failed:", error);
    } finally {
        localMusicState$.isScanning.set(false);
    }
}

// Set current playlist selection
export function setCurrentPlaylist(playlistId: string, playlistType: "file"): void {
    localMusicState$.isLocalFilesSelected.set(true);

    console.log("setCurrentPlaylist", playlistId, playlistType);

    // Save current playlist to persistent state
    stateSaved$.assign({
        playlist: playlistId,
        playlistType,
    });
}

stateSaved$.playlist.onChange(({ value }) => {
    console.log("stateSaved$.playlist.onChange", value);
});
stateSaved$.playlistType.onChange(({ value }) => {
    console.log("stateSaved$.playlistType.onChange", value);
});

// Initialize and scan on app start
export function initializeLocalMusic(): void {
    const settings = localMusicSettings$.get();

    // Restore isLocalFilesSelected state based on saved playlist type
    const savedPlaylistType = stateSaved$.playlistType.get();
    if (savedPlaylistType === "file") {
        localMusicState$.isLocalFilesSelected.set(true);
        console.log("Restored Local Files playlist selection on startup");
    }

    if (settings.autoScanOnStart) {
        console.log("Auto-scanning local music on startup...");
        scanLocalMusic().catch((error) => {
            console.error("Failed to auto-scan local music:", error);
        });
    }
}
