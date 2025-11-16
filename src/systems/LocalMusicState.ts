import { observable } from "@legendapp/state";
import { Directory, File } from "expo-file-system/next";
import { Skia } from "@shopify/react-native-skia";
import * as ID3 from "id3js";
import type { JsMediaTagsSuccess } from "jsmediatags/build2/jsmediatags";
import jsmediatags from "jsmediatags/build2/jsmediatags";
import AudioPlayer from "@/native-modules/AudioPlayer";
import { addChangeListener, setWatchedDirectories } from "@/native-modules/FileSystemWatcher";
import { hasCachedLibraryData } from "@/systems/LibraryCache";
import { hasCachedPlaylistData } from "@/systems/PlaylistCache";
import { stateSaved$ } from "@/systems/State";
import { ensureCacheDirectory, getCacheDirectory } from "@/utils/cacheDirectories";
import { createJSONManager } from "@/utils/JSONManager";
import { perfCount, perfDelta, perfLog, perfTime } from "@/utils/perfLogger";
import { runAfterInteractions } from "@/utils/runAfterInteractions";
import { DEFAULT_LOCAL_PLAYLIST_ID, DEFAULT_LOCAL_PLAYLIST_NAME } from "./localMusicConstants";

export interface LocalTrack {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration: string;
    filePath: string;
    fileName: string;
    thumbnail?: string;
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
        const image = Skia.Image.MakeImageFromEncoded(buffer);
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

        canvas.drawImageRect(image, srcRect, destRect, null);

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

    const buffer = imageDataToUint8Array(image.data);
    if (!buffer) {
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

    let bufferToWrite = buffer;
    if (!looksLikeJpeg && looksUnsyncedJpeg) {
        bufferToWrite = stripUnsynchronization(buffer);
    }

    const scaledBuffer = downscaleArtworkToSquare(bufferToWrite, 128);
    const outputBuffer = scaledBuffer ?? bufferToWrite;
    const outputExtension = scaledBuffer ? "png" : extension;

    const cacheFile = new File(thumbnailsDir, `${cacheKey}.${outputExtension}`);
    try {
        cacheFile.create({ overwrite: true, intermediates: true });
        cacheFile.write(outputBuffer);
        return cacheFile.uri;
    } catch (error) {
        console.warn(`Failed to cache album art for ${filePath}:`, error);
        return undefined;
    }
}

async function readTagsWithJsMediaTags(filePath: string): Promise<JsMediaTagsSuccess | undefined> {
    return new Promise((resolve) => {
        try {
            new jsmediatags.Reader(filePath).setTagsToRead(["picture"]).read({
                onSuccess: (data) => {
                    resolve(data);
                },
                onError: (error) => {
                    console.warn(
                        `jsmediatags failed to read tags for ${fileNameFromPath(filePath)}:`,
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

const thumbnailLoadPromises = new Map<string, Promise<string | undefined>>();

function updateTrackThumbnail(trackId: string, thumbnail?: string): void {
    const tracks = localMusicState$.tracks.get();
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index === -1) {
        return;
    }

    if (tracks[index].thumbnail === thumbnail) {
        return;
    }

    const nextTracks = [...tracks];
    nextTracks[index] = { ...nextTracks[index], thumbnail };
    localMusicState$.tracks.set(nextTracks);
}

async function loadThumbnailForTrack(filePath: string): Promise<string | undefined> {
    const tags = await readTagsWithJsMediaTags(filePath);
    if (!tags?.tags) {
        return undefined;
    }

    try {
        return await extractEmbeddedArtwork(filePath, tags.tags);
    } catch (error) {
        console.warn(`Failed to extract artwork via jsmediatags for ${fileNameFromPath(filePath)}:`, error);
        return undefined;
    }
}

export async function ensureLocalTrackThumbnail(track: LocalTrack): Promise<string | undefined> {
    if (track.thumbnail) {
        return track.thumbnail;
    }

    const existing = thumbnailLoadPromises.get(track.filePath);
    if (existing) {
        const uri = await existing;
        if (uri) {
            updateTrackThumbnail(track.id, uri);
        }
        return uri;
    }

    const loadPromise = (async () => {
        const uri = await loadThumbnailForTrack(track.filePath);
        if (uri) {
            updateTrackThumbnail(track.id, uri);
        }
        return uri;
    })();

    thumbnailLoadPromises.set(track.filePath, loadPromise);

    try {
        return await loadPromise;
    } finally {
        thumbnailLoadPromises.delete(track.filePath);
    }
}

// Extract metadata from ID3 tags with filename fallback
async function extractId3Metadata(
    filePath: string,
    fileName: string,
): Promise<{ title: string; artist: string; album?: string; duration?: string }> {
    perfCount("LocalMusic.extractId3Metadata");

    const fallback = parseFilenameOnly(fileName);
    let title = fallback.title;
    let artist = fallback.artist;
    let album: string | undefined;
    let duration: string | undefined;

    try {
        // First try to extract ID3 tags
        const tags = await perfTime("LocalMusic.ID3.fromPath", () => ID3.fromPath(filePath));

        if (tags) {
            title = tags.title || title;
            artist = tags.artist || artist;
            album = tags.album || album;

            const tagDurationSeconds = parseDurationFromTags(tags);
            if (tagDurationSeconds !== null) {
                duration = formatDuration(tagDurationSeconds);
            }
        }
    } catch (error) {
        console.warn(`Failed to read ID3 tags from ${fileName}:`, error);
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
        album,
        duration,
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

    configureLibraryPathWatcher(settings.libraryPaths);

    if (!hasSubscribedToLibraryPathChanges) {
        hasSubscribedToLibraryPathChanges = true;
        localMusicSettings$.libraryPaths.onChange(({ value }) => {
            const nextPaths = Array.isArray(value) ? value : [];
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
