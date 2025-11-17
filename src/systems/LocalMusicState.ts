import { observable } from "@legendapp/state";
import { Skia } from "@shopify/react-native-skia";
import { Directory, File } from "expo-file-system/next";
import AudioPlayer, {
    type MediaScanBatchEvent,
    type MediaScanProgressEvent,
    type MediaScanResult,
} from "@/native-modules/AudioPlayer";
import { addChangeListener, setWatchedDirectories } from "@/native-modules/FileSystemWatcher";
import { clearLibraryCache, hasCachedLibraryData } from "@/systems/LibraryCache";
import { hasCachedPlaylistData } from "@/systems/PlaylistCache";
import { stateSaved$ } from "@/systems/State";
import { ensureCacheDirectory, getCacheDirectory } from "@/utils/cacheDirectories";
import { createJSONManager } from "@/utils/JSONManager";
import { perfCount, perfDelta, perfLog, perfTime } from "@/utils/perfLogger";
import { runAfterInteractions } from "@/utils/runAfterInteractions";
import { DEFAULT_LOCAL_PLAYLIST_ID } from "./localMusicConstants";

export interface LocalTrack {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration: string;
    filePath: string;
    fileName: string;
    thumbnail?: string;
    thumbnailKey?: string;
}

export interface LocalPlaylist {
    id: string;
    name: string;
    filePath: string;
    trackPaths: string[];
    trackCount: number;
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
    playlists: LocalPlaylist[];
}

export { DEFAULT_LOCAL_PLAYLIST_ID, DEFAULT_LOCAL_PLAYLIST_NAME } from "./localMusicConstants";

// Settings persistence
export const localMusicSettings$ = createJSONManager<LocalMusicSettings>({
    filename: "localMusicSettings",
    initialValue: {
        libraryPaths: [],
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
    playlists: [],
});

const FILE_WATCH_DEBOUNCE_MS = 2000;

let removeLibraryWatcher: (() => void) | undefined;
let libraryWatcherTimeout: ReturnType<typeof setTimeout> | undefined;
let hasSubscribedToLibraryPathChanges = false;
let lastLibraryPaths: string[] = [];

function clearCachedLibraryData(): void {
    clearLibraryCache();
    localMusicSettings$.lastScanTime.set(0);
    localMusicState$.tracks.set([]);
}

function scheduleScanAfterFileChange(): void {
    if (libraryWatcherTimeout) {
        clearTimeout(libraryWatcherTimeout);
    }

    libraryWatcherTimeout = setTimeout(() => {
        libraryWatcherTimeout = undefined;

        if (localMusicState$.isScanning.get()) {
            scheduleScanAfterFileChange();
            return;
        }

        console.log("Rescanning local music after filesystem change");
        scanLocalMusic().catch((error) => {
            console.error("Failed to rescan local music after filesystem change:", error);
        });
    }, FILE_WATCH_DEBOUNCE_MS);
}

function configureLibraryPathWatcher(paths: string[]): void {
    try {
        setWatchedDirectories(paths);
    } catch (error) {
        console.error("Failed to configure filesystem watcher for local music:", error);
        return;
    }

    if (paths.length === 0) {
        if (removeLibraryWatcher) {
            removeLibraryWatcher();
            removeLibraryWatcher = undefined;
        }
        return;
    }

    if (!removeLibraryWatcher) {
        removeLibraryWatcher = addChangeListener(() => {
            scheduleScanAfterFileChange();
        });
    }
}

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

function imageDataToUint8Array(data: ID3ImageValue["data"]): Uint8Array | null {
    if (!data) {
        return null;
    }

    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }

    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }

    if (Array.isArray(data)) {
        return Uint8Array.from(data);
    }

    return null;
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

function downscaleArtworkToSquare(buffer: Uint8Array, targetSize = 128): Uint8Array | null {
    try {
        const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(buffer));
        if (!image) {
            return null;
        }

        const sourceWidth = image.width();
        const sourceHeight = image.height();
        if (sourceWidth === 0 || sourceHeight === 0) {
            return null;
        }

        const cropSize = Math.min(sourceWidth, sourceHeight);
        const srcX = Math.floor((sourceWidth - cropSize) / 2);
        const srcY = Math.floor((sourceHeight - cropSize) / 2);

        const surface = Skia.Surface.Make(targetSize, targetSize);
        if (!surface) {
            return null;
        }

        const canvas = surface.getCanvas();
        const srcRect = Skia.XYWHRect(srcX, srcY, cropSize, cropSize);
        const destRect = Skia.XYWHRect(0, 0, targetSize, targetSize);

        canvas.drawImageRect(image, srcRect, destRect, Skia.Paint());

        const snapshot = surface.makeImageSnapshot();
        const encoded = snapshot.encodeToBytes();
        if (!encoded || encoded.length === 0) {
            return null;
        }

        return encoded;
    } catch (error) {
        console.warn("Failed to downscale artwork", error);
        return null;
    }
}

function fileNameFromPath(path: string): string {
    const lastSlash = path.lastIndexOf("/");
    return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

function normalizeRootPath(path: string): string {
    if (!path) {
        return "";
    }

    const withoutPrefix = path.startsWith("file://") ? path.replace("file://", "") : path;
    const trimmed = withoutPrefix.replace(/\/+$/, "");
    return trimmed.length > 0 ? trimmed : withoutPrefix;
}

function buildAbsolutePath(rootPath: string, relativePath: string): string {
    if (relativePath.startsWith("/")) {
        return relativePath;
    }

    const normalizedRoot = normalizeRootPath(rootPath);
    if (normalizedRoot.endsWith("/")) {
        return `${normalizedRoot}${relativePath}`;
    }

    return `${normalizedRoot}/${relativePath}`;
}

function buildThumbnailUri(baseUri: string, key?: string): string | undefined {
    if (!key || !baseUri) {
        return undefined;
    }

    const normalizedBase = baseUri.endsWith("/") ? baseUri.slice(0, -1) : baseUri;
    return `${normalizedBase}/${key}.png`;
}

function joinPath(parent: string, child: string): string {
    const trimmedChild = child.startsWith("/") ? child.replace(/^\/+/, "") : child;
    if (parent.endsWith("/")) {
        return `${parent}${trimmedChild}`;
    }
    return `${parent}/${trimmedChild}`;
}

function decodeFSComponent(name: string, context: string): string {
    try {
        return decodeURIComponent(name);
    } catch (error) {
        console.warn(`Failed to decode filesystem component ${name} in ${context}`, error);
        return name;
    }
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

export async function ensureLocalTrackThumbnail(track: LocalTrack): Promise<string | undefined> {
    // Thumbnails are now provided via native getMediaTags; nothing to do here.
    return track.thumbnail;
}

// Extract metadata from ID3 tags with filename fallback
async function extractId3Metadata(
    filePath: string,
    fileName: string,
): Promise<{ title: string; artist: string; album?: string; duration?: string; thumbnail?: string; thumbnailKey?: string }> {
    perfCount("LocalMusic.extractId3Metadata");

    const fallback = parseFilenameOnly(fileName);
    let title = fallback.title;
    let artist = fallback.artist;
    let album: string | undefined;
    let duration: string | undefined;
    let thumbnail: string | undefined;
    let thumbnailKey: string | undefined;

    const thumbnailsDir = getCacheDirectory("thumbnails");
    ensureCacheDirectory(thumbnailsDir);

    const thumbnailsDirUri = thumbnailsDir.uri;

    // console.log("extractId3Metadata", thumbnailsDirUri);

    try {
        const nativeTags = await AudioPlayer.getMediaTags(filePath, thumbnailsDirUri);
        if (nativeTags) {
            if (typeof nativeTags.title === "string" && nativeTags.title.trim().length > 0) {
                title = nativeTags.title;
            }
            if (typeof nativeTags.artist === "string" && nativeTags.artist.trim().length > 0) {
                artist = nativeTags.artist;
            }
            if (typeof nativeTags.album === "string" && nativeTags.album.trim().length > 0) {
                album = nativeTags.album;
            }
            if (
                typeof nativeTags.durationSeconds === "number" &&
                Number.isFinite(nativeTags.durationSeconds) &&
                nativeTags.durationSeconds > 0
            ) {
                duration = formatDuration(nativeTags.durationSeconds);
            }
            const nativeThumbnailKey =
                typeof nativeTags.artworkKey === "string" && nativeTags.artworkKey.length > 0
                    ? nativeTags.artworkKey
                    : undefined;
            if (nativeThumbnailKey) {
                thumbnailKey = nativeThumbnailKey;
                thumbnail = buildThumbnailUri(thumbnailsDirUri, nativeThumbnailKey) ?? thumbnail;
            }
            if (!thumbnail && typeof nativeTags.artworkUri === "string" && nativeTags.artworkUri.length > 0) {
                thumbnail = nativeTags.artworkUri;
            }
        }
    } catch (error) {
        console.warn(`extractId3Metadata: Failed to read native metadata for ${fileName}:`, error);
    }

    // console.log("extractId3Metadata", title, artist, album, duration, thumbnail);

    // if (title === undefined || artist === undefined || album === undefined) {
    //     console.log('extractId3Metadata did not load title or artist or album')
    // }

    // try {
    //     // First try to extract ID3 tags
    //     const tags = await perfTime("LocalMusic.ID3.fromPath", () => ID3.fromPath(filePath));

    //     if (tags) {
    //         title = tags.title || title;
    //         artist = tags.artist || artist;
    //         album = tags.album || album;

    //         const tagDurationSeconds = parseDurationFromTags(tags);
    //         if (tagDurationSeconds !== null) {
    //             duration = formatDuration(tagDurationSeconds);
    //         }
    //     }
    // } catch (error) {
    //     console.warn(`Failed to read ID3 tags from ${fileName}:`, error);
    // }

    return {
        title,
        artist,
        album,
        duration,
        thumbnail,
        thumbnailKey,
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

/**
 * Creates a LocalTrack for an arbitrary audio file path by reusing the ID3 and native metadata pipeline.
 */
export async function createLocalTrackFromFile(filePath: string): Promise<LocalTrack> {
    const fileName = fileNameFromPath(filePath);

    try {
        const metadata = await extractId3Metadata(filePath, fileName);

        return {
            id: filePath,
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            duration: metadata.duration ?? "0:00",
            thumbnail: metadata.thumbnail,
            thumbnailKey: metadata.thumbnailKey,
            filePath,
            fileName,
        };
    } catch (error) {
        console.error(`Failed to create LocalTrack from ${fileName}:`, error);

        const fallback = parseFilenameOnly(fileName);
        return {
            id: filePath,
            title: fallback.title,
            artist: fallback.artist,
            duration: "0:00",
            filePath,
            fileName,
        };
    }
}

async function scanLibraryNative(paths: string[], thumbnailsDirUri: string): Promise<LocalTrack[]> {
    if (paths.length === 0) {
        return [];
    }

    if (typeof AudioPlayer.scanMediaLibrary !== "function") {
        throw new Error("Native scan is not available");
    }

    const normalizedRoots = paths.map((path) => normalizeRootPath(path));
    const tracks: LocalTrack[] = [];
    const seenPaths = new Set<string>();

    const handleBatch = (event: MediaScanBatchEvent) => {
        if (!event || !Array.isArray(event.tracks)) {
            return;
        }

        const rootIndex = typeof event.rootIndex === "number" ? event.rootIndex : -1;
        const rootPath = normalizedRoots[rootIndex];
        if (!rootPath) {
            return;
        }

        for (const nativeTrack of event.tracks) {
            const relativePath =
                typeof nativeTrack.relativePath === "string" && nativeTrack.relativePath.length > 0
                    ? nativeTrack.relativePath
                    : typeof nativeTrack.fileName === "string"
                      ? nativeTrack.fileName
                      : "";

            if (!relativePath) {
                continue;
            }

            const absolutePath = relativePath.startsWith("/")
                ? relativePath
                : buildAbsolutePath(rootPath, relativePath);

            if (seenPaths.has(absolutePath)) {
                continue;
            }

            const fileName = nativeTrack.fileName ?? fileNameFromPath(absolutePath);
            const fallback = parseFilenameOnly(fileName);
            const title =
                typeof nativeTrack.title === "string" && nativeTrack.title.trim().length > 0
                    ? nativeTrack.title
                    : fallback.title;
            const artist =
                typeof nativeTrack.artist === "string" && nativeTrack.artist.trim().length > 0
                    ? nativeTrack.artist
                    : fallback.artist;
            const album =
                typeof nativeTrack.album === "string" && nativeTrack.album.trim().length > 0 ? nativeTrack.album : undefined;

            const durationSeconds =
                typeof nativeTrack.durationSeconds === "number" && Number.isFinite(nativeTrack.durationSeconds)
                    ? nativeTrack.durationSeconds
                    : undefined;

            const thumbnailKey =
                typeof nativeTrack.artworkKey === "string" && nativeTrack.artworkKey.length > 0
                    ? nativeTrack.artworkKey
                    : undefined;
            const thumbnailUri =
                buildThumbnailUri(thumbnailsDirUri, thumbnailKey) ??
                (typeof nativeTrack.artworkUri === "string" && nativeTrack.artworkUri.length > 0
                    ? nativeTrack.artworkUri
                    : undefined);

            tracks.push({
                id: absolutePath,
                title,
                artist,
                album,
                duration: durationSeconds ? formatDuration(durationSeconds) : "0:00",
                thumbnail: thumbnailUri,
                thumbnailKey,
                filePath: absolutePath,
                fileName,
            });

            seenPaths.add(absolutePath);
        }
    };

    const handleProgress = (event: MediaScanProgressEvent) => {
        const totalRoots =
            typeof event.totalRoots === "number" && event.totalRoots > 0 ? event.totalRoots : normalizedRoots.length;
        const completedRoots = Math.min(
            totalRoots,
            typeof event.completedRoots === "number" ? event.completedRoots : event.rootIndex + 1,
        );

        localMusicState$.scanTotal.set(totalRoots);
        localMusicState$.scanProgress.set(completedRoots);
    };

    const handleComplete = (event: MediaScanResult) => {
        const totalRoots =
            typeof event.totalRoots === "number" && event.totalRoots > 0 ? event.totalRoots : normalizedRoots.length;
        localMusicState$.scanTotal.set(totalRoots);
        localMusicState$.scanProgress.set(totalRoots);
    };

    const subscriptions = [
        AudioPlayer.addListener("onMediaScanBatch", handleBatch),
        AudioPlayer.addListener("onMediaScanProgress", handleProgress),
        AudioPlayer.addListener("onMediaScanComplete", handleComplete),
    ];

    try {
        const result = await AudioPlayer.scanMediaLibrary(normalizedRoots, thumbnailsDirUri, { batchSize: 48 });
        const totalRoots =
            typeof result.totalRoots === "number" && result.totalRoots > 0 ? result.totalRoots : normalizedRoots.length;
        localMusicState$.scanTotal.set(totalRoots);
        localMusicState$.scanProgress.set(totalRoots);
        return tracks;
    } finally {
        for (const subscription of subscriptions) {
            try {
                subscription?.remove?.();
            } catch (error) {
                console.warn("Failed to remove media scan listener", error);
            }
        }
    }
}

async function scanLibraryFallback(paths: string[]): Promise<LocalTrack[]> {
    const tracks: LocalTrack[] = [];

    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];

        try {
            const directoryTracks = await perfTime("LocalMusic.scanDirectory.total", () => scanDirectory(path));
            tracks.push(...directoryTracks);
        } catch (error) {
            console.error(`Failed to scan ${path}:`, error);
        }

        localMusicState$.scanProgress.set(i + 1);
    }

    return tracks;
}

// Scan directory for MP3 files
async function scanDirectory(directoryPath: string): Promise<LocalTrack[]> {
    const tracks: LocalTrack[] = [];
    const visited = new Set<string>();
    const pending: string[] = [directoryPath];

    try {
        perfLog("LocalMusic.scanDirectory.start", { directoryPath });
        while (pending.length > 0) {
            const currentPath = pending.pop();
            if (!currentPath || visited.has(currentPath)) {
                continue;
            }

            visited.add(currentPath);

            const directory = new Directory(currentPath);

            if (!directory.exists) {
                console.warn(`Directory does not exist: ${currentPath}`);
                continue;
            }

            let items: (Directory | File)[] = [];

            try {
                items = perfTime("LocalMusic.Directory.list", () => directory.list());
            } catch (error) {
                console.error(`Failed to list directory ${currentPath}:`, error);
                continue;
            }

            for (const item of items) {
                perfCount("LocalMusic.scanDirectory.item");

                if (item instanceof File) {
                    const decodedFileName = decodeFSComponent(item.name, currentPath);
                    if (!decodedFileName.toLowerCase().endsWith(".mp3")) {
                        continue;
                    }

                    const filePath = joinPath(currentPath, decodedFileName);

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
                            album: metadata.album,
                            duration: metadata.duration || "0:00",
                            thumbnail: metadata.thumbnail,
                            thumbnailKey: metadata.thumbnailKey,
                            filePath,
                            fileName: item.name,
                        };

                        tracks.push(track);
                    } catch (error) {
                        console.error(`Failed to process MP3 file ${item.name}:`, error);
                        // Continue with other files
                    }
                    continue;
                }

                if (item instanceof Directory) {
                    const decodedDirectoryName = decodeFSComponent(item.name, currentPath);
                    const childPath = joinPath(currentPath, decodedDirectoryName);
                    if (!visited.has(childPath)) {
                        pending.push(childPath);
                    }
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
    const paths = localMusicSettings$.libraryPaths.get().map((path) => normalizeRootPath(path)).filter(Boolean);

    if (paths.length === 0) {
        localMusicState$.error.set("No library paths configured");
        return;
    }

    const thumbnailsDir = getCacheDirectory("thumbnails");
    ensureCacheDirectory(thumbnailsDir);

    perfLog("LocalMusic.scanLocalMusic.start", { paths });
    localMusicState$.isScanning.set(true);
    localMusicState$.error.set(null);
    localMusicState$.scanProgress.set(0);
    localMusicState$.scanTotal.set(paths.length);

    try {
        let collectedTracks: LocalTrack[] = [];

        try {
            collectedTracks = await scanLibraryNative(paths, thumbnailsDir.uri);
        } catch (nativeError) {
            console.warn("Native scan failed, falling back to JS pipeline:", nativeError);
            localMusicState$.scanProgress.set(0);
            localMusicState$.scanTotal.set(paths.length);
            collectedTracks = await scanLibraryFallback(paths);
        }

        const dedupedTracks = Array.from(new Map(collectedTracks.map((track) => [track.id, track])).values());

        dedupedTracks.sort((a, b) => {
            const artistCompare = a.artist.localeCompare(b.artist);
            if (artistCompare !== 0) return artistCompare;
            return a.title.localeCompare(b.title);
        });

        perfLog("LocalMusic.scanLocalMusic.done", { total: dedupedTracks.length });
        localMusicState$.tracks.set(dedupedTracks);
        localMusicSettings$.lastScanTime.set(Date.now());
        localMusicState$.scanProgress.set(localMusicState$.scanTotal.get());

        console.log(`Scan complete: Found ${dedupedTracks.length} total MP3 files`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        localMusicState$.error.set(`Scan failed: ${errorMessage}`);
        console.error("Local music scan failed:", error);
    } finally {
        localMusicState$.isScanning.set(false);
    }
}

export async function loadLocalPlaylists(): Promise<void> {
    perfLog("LocalMusic.loadLocalPlaylists.start");

    const playlistDirectory = getCacheDirectory("playlists");
    ensureCacheDirectory(playlistDirectory);

    let entries: (Directory | File)[] = [];
    try {
        entries = playlistDirectory.list();
    } catch (error) {
        console.error("Failed to list playlists directory:", error);
        localMusicState$.playlists.set([]);
        return;
    }

    const playlists: LocalPlaylist[] = [];
    const toFilePath = (value: string): string => (value.startsWith("file://") ? new URL(value).pathname : value);

    for (const entry of entries) {
        if (!(entry instanceof File)) {
            continue;
        }

        if (!entry.name.toLowerCase().endsWith(".m3u")) {
            continue;
        }

        try {
            const content = entry.text();
            const trackPaths = content
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0 && !line.startsWith("#"))
                .map((line) => toFilePath(line));

            playlists.push({
                id: toFilePath(entry.uri),
                name: entry.name.replace(/\.m3u$/i, ""),
                filePath: toFilePath(entry.uri),
                trackPaths,
                trackCount: trackPaths.length,
            });
        } catch (error) {
            console.warn(`Failed to read playlist ${entry.uri}:`, error);
        }
    }

    playlists.sort((a, b) => a.name.localeCompare(b.name));

    localMusicState$.playlists.set(playlists);
    perfLog("LocalMusic.loadLocalPlaylists.end", { total: playlists.length });
}

// Set current playlist selection
export function setCurrentPlaylist(playlistId: string, playlistType: "file"): void {
    localMusicState$.isLocalFilesSelected.set(playlistId === DEFAULT_LOCAL_PLAYLIST_ID);

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

    console.log("initializeLocalMusic", settings);

    lastLibraryPaths = Array.isArray(settings.libraryPaths) ? [...settings.libraryPaths] : [];
    configureLibraryPathWatcher(lastLibraryPaths);

    if (!hasSubscribedToLibraryPathChanges) {
        hasSubscribedToLibraryPathChanges = true;
        localMusicSettings$.libraryPaths.onChange(({ value }) => {
            const nextPaths = Array.isArray(value) ? [...value] : [];
            const removedPaths = lastLibraryPaths.filter((path) => !nextPaths.includes(path));
            if (removedPaths.length > 0) {
                clearCachedLibraryData();
            }
            lastLibraryPaths = nextPaths;
            configureLibraryPathWatcher(nextPaths);
            scheduleScanAfterFileChange();
        });
    }

    // Restore isLocalFilesSelected state based on saved playlist type
    const savedPlaylistType = stateSaved$.playlistType.get();
    if (savedPlaylistType === "file") {
        const savedPlaylistId = stateSaved$.playlist.get();
        const isLocalFiles = savedPlaylistId === DEFAULT_LOCAL_PLAYLIST_ID;
        localMusicState$.isLocalFilesSelected.set(isLocalFiles);
        if (isLocalFiles) {
            console.log("Restored default library playlist selection on startup");
        }
    }

    loadLocalPlaylists().catch((error) => {
        console.error("Failed to load local playlists:", error);
    });

    if (settings.autoScanOnStart) {
        const playlistCacheReady = hasCachedPlaylistData();
        const libraryCacheReady = hasCachedLibraryData();
        const deferInitialScan = playlistCacheReady || libraryCacheReady;

        perfLog("LocalMusic.autoScan.policy", { deferInitialScan, playlistCacheReady, libraryCacheReady });

        if (deferInitialScan) {
            console.log("Deferring auto-scan of local music until idle (cache available)");
            runAfterInteractions(() => {
                console.log("Auto-scanning local music during idle...");
                scanLocalMusic().catch((error) => {
                    console.error("Failed to auto-scan local music:", error);
                });
            });
        } else {
            console.log("Auto-scanning local music on startup...");
            scanLocalMusic().catch((error) => {
                console.error("Failed to auto-scan local music:", error);
            });
        }
    }
}
