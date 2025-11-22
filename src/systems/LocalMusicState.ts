import { observable } from "@legendapp/state";
import { Directory, File } from "expo-file-system/next";
import AudioPlayer, {
    type MediaScanBatchEvent,
    type MediaScanProgressEvent,
    type MediaScanResult,
} from "@/native-modules/AudioPlayer";
import { addChangeListener, setWatchedDirectories } from "@/native-modules/FileSystemWatcher";
import {
    clearLibraryCache,
    getLibrarySnapshot,
    hasCachedLibraryData,
    type PersistedLibraryTrack,
} from "@/systems/LibraryCache";
import { hasCachedPlaylistData } from "@/systems/PlaylistCache";
import { DEBUG_LOCAL_MUSIC_LOGS } from "@/systems/constants";
import { stateSaved$ } from "@/systems/State";
import { ensureCacheDirectory, getCacheDirectory } from "@/utils/cacheDirectories";
import { createJSONManager } from "@/utils/JSONManager";
import { perfCount, perfLog } from "@/utils/perfLogger";
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
    thumbnailVersion?: number;
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
    scanTrackProgress: number;
    scanTrackTotal: number;
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
    scanTrackProgress: 0,
    scanTrackTotal: 0,
    error: null,
    isLocalFilesSelected: false,
    playlists: [],
});

const FILE_WATCH_DEBOUNCE_MS = 2000;
let pendingUserInitiatedLibraryChange = false;

let removeLibraryWatcher: (() => void) | undefined;
let libraryWatcherTimeout: ReturnType<typeof setTimeout> | undefined;
let hasSubscribedToLibraryPathChanges = false;
let lastLibraryPaths: string[] = [];
const debugLocalMusicLog = (...args: unknown[]) => {
    if (DEBUG_LOCAL_MUSIC_LOGS) {
        console.log(...args);
    }
};

function clearCachedLibraryData(): void {
    clearLibraryCache();
    localMusicSettings$.lastScanTime.set(0);
    localMusicState$.tracks.set([]);
    localMusicState$.scanTrackProgress.set(0);
    localMusicState$.scanTrackTotal.set(0);
}

function scheduleScanAfterFileChange(delayMs = FILE_WATCH_DEBOUNCE_MS): void {
    if (libraryWatcherTimeout) {
        clearTimeout(libraryWatcherTimeout);
    }

    libraryWatcherTimeout = setTimeout(
        () => {
            libraryWatcherTimeout = undefined;

            if (localMusicState$.isScanning.get()) {
                scheduleScanAfterFileChange(delayMs);
                return;
            }

            debugLocalMusicLog("Rescanning local music after filesystem change");
            scanLocalMusic().catch((error) => {
                console.error("Failed to rescan local music after filesystem change:", error);
            });
        },
        Math.max(0, delayMs),
    );
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

async function validateLibraryPaths(paths: string[]): Promise<{ existing: string[]; missing: string[] }> {
    if (paths.length === 0) {
        return { existing: [], missing: [] };
    }

    const results = await Promise.all(
        paths.map(async (path) => {
            try {
                const directory = new Directory(path);
                const exists = directory.exists;
                return { path, exists };
            } catch (error) {
                console.warn(`validateLibraryPaths: failed to inspect ${path}`, error);
                return { path, exists: false };
            }
        }),
    );

    return {
        existing: results.filter((result) => result.exists).map((result) => result.path),
        missing: results.filter((result) => !result.exists).map((result) => result.path),
    };
}

function dedupeTracksByPath(tracks: LocalTrack[]): LocalTrack[] {
    const unique = new Map<string, LocalTrack>();

    for (const track of tracks) {
        const normalizedPath = normalizeRootPath(track.filePath || track.id);
        if (!normalizedPath) {
            continue;
        }

        const key = normalizedPath.toLowerCase();
        if (unique.has(key)) {
            continue;
        }

        unique.set(key, {
            ...track,
            id: track.id || normalizedPath,
            filePath: normalizedPath,
            fileName: track.fileName ?? fileNameFromPath(normalizedPath),
        });
    }

    return Array.from(unique.values());
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

function extractThumbnailKeyFromPersisted(track: PersistedLibraryTrack | undefined): string | undefined {
    if (!track) {
        return undefined;
    }

    if (track.thumb?.length) {
        return track.thumb;
    }

    if (track.thumbnail?.length) {
        const fileName = track.thumbnail.split("/").pop() ?? track.thumbnail;
        const [baseName] = fileName.split(".");
        return baseName && baseName.length > 0 ? baseName : undefined;
    }

    return undefined;
}

function isLocalFileUri(uri: string): boolean {
    return uri.startsWith("file://") || uri.startsWith("/");
}

function thumbnailFileExists(uri: string): boolean {
    try {
        const thumbnailFile = new File(uri);
        return thumbnailFile.exists;
    } catch (error) {
        console.warn(`ensureLocalTrackThumbnail: Failed to check thumbnail at ${uri}:`, error);
        return false;
    }
}

function buildCachedTrackIndex(normalizedRoots: string[]): {
    skipEntries: { rootIndex: number; relativePath: string }[];
    cachedTracksByRoot: Map<number, Map<string, PersistedLibraryTrack>>;
    cachedTrackCount: number;
} {
    const snapshot = getLibrarySnapshot();
    const snapshotTracks = Array.isArray(snapshot.tracks) ? snapshot.tracks : [];
    const cachedTrackCount = snapshotTracks.length;
    if (cachedTrackCount === 0) {
        return { skipEntries: [], cachedTracksByRoot: new Map(), cachedTrackCount: 0 };
    }

    const snapshotRoots = Array.isArray(snapshot.roots)
        ? snapshot.roots.map((root) => normalizeRootPath(root)).filter(Boolean)
        : [];

    const skipEntries: { rootIndex: number; relativePath: string }[] = [];
    const cachedTracksByRoot = new Map<number, Map<string, PersistedLibraryTrack>>();
    const seen = new Set<string>();

    normalizedRoots.forEach((rootPath, currentRootIndex) => {
        const snapshotRootIndex = snapshotRoots.indexOf(rootPath);
        if (snapshotRootIndex === -1) {
            return;
        }

        const tracksForRoot = snapshotTracks.filter((track) => track.root === snapshotRootIndex);
        if (tracksForRoot.length === 0) {
            return;
        }

        const map = new Map<string, PersistedLibraryTrack>();
        for (const track of tracksForRoot) {
            const relativePath = track.rel ?? "";
            if (!relativePath) {
                continue;
            }
            map.set(relativePath, track);
            const cacheKey = `${currentRootIndex}:${relativePath}`;
            if (!seen.has(cacheKey)) {
                skipEntries.push({ rootIndex: currentRootIndex, relativePath });
                seen.add(cacheKey);
            }
        }

        if (map.size > 0) {
            cachedTracksByRoot.set(currentRootIndex, map);
        }
    });

    return { skipEntries, cachedTracksByRoot, cachedTrackCount };
}

export async function ensureLocalTrackThumbnail(track: LocalTrack): Promise<string | undefined> {
    const thumbnailUri = track.thumbnail;
    const hasLocalThumbnail = thumbnailUri?.length && isLocalFileUri(thumbnailUri);
    const missingLocalThumbnail = Boolean(
        thumbnailUri?.length && hasLocalThumbnail && !thumbnailFileExists(thumbnailUri),
    );

    if (thumbnailUri?.length && !missingLocalThumbnail) {
        return thumbnailUri;
    }

    if (missingLocalThumbnail) {
        track.thumbnail = undefined;
    }

    const thumbnailsDir = getCacheDirectory("thumbnails");
    ensureCacheDirectory(thumbnailsDir);

    const fromKey = buildThumbnailUri(thumbnailsDir.uri, track.thumbnailKey);
    if (fromKey && thumbnailFileExists(fromKey)) {
        track.thumbnail = fromKey;
        if (missingLocalThumbnail) {
            track.thumbnailVersion = Date.now();
        }
        return fromKey;
    }

    try {
        const metadata = await extractId3Metadata(track.filePath, track.fileName);
        if (metadata.thumbnailKey && !track.thumbnailKey) {
            track.thumbnailKey = metadata.thumbnailKey;
        }
        if (metadata.thumbnail) {
            track.thumbnail = metadata.thumbnail;
            if (missingLocalThumbnail && isLocalFileUri(metadata.thumbnail)) {
                track.thumbnailVersion = Date.now();
            }
        }
        return metadata.thumbnail;
    } catch (error) {
        console.warn(`ensureLocalTrackThumbnail: Failed to resolve thumbnail for ${track.fileName}:`, error);
        return undefined;
    }
}

// Extract metadata from ID3 tags with filename fallback
async function extractId3Metadata(
    filePath: string,
    fileName: string,
): Promise<{
    title: string;
    artist: string;
    album?: string;
    duration?: string;
    thumbnail?: string;
    thumbnailKey?: string;
}> {
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
            if (nativeTags.title?.trim()) {
                title = nativeTags.title;
            }
            if (nativeTags.artist?.trim()) {
                artist = nativeTags.artist;
            }
            if (nativeTags.album?.trim()) {
                album = nativeTags.album;
            }
            if (Number.isFinite(nativeTags.durationSeconds) && nativeTags.durationSeconds > 0) {
                duration = formatDuration(nativeTags.durationSeconds);
            }
            const nativeThumbnailKey = nativeTags.artworkKey?.length ? nativeTags.artworkKey : undefined;
            if (nativeThumbnailKey) {
                thumbnailKey = nativeThumbnailKey;
                thumbnail = buildThumbnailUri(thumbnailsDirUri, nativeThumbnailKey) ?? thumbnail;
            }
            if (!thumbnail && nativeTags.artworkUri?.length) {
                thumbnail = nativeTags.artworkUri;
            }
        }
    } catch (error) {
        console.warn(`extractId3Metadata: Failed to read native metadata for ${fileName}:`, error);
    }

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

async function scanLibraryNative(
    paths: string[],
    thumbnailsDirUri: string,
): Promise<{ tracks: LocalTrack[]; errors: string[] }> {
    if (paths.length === 0) {
        return { tracks: [], errors: [] };
    }

    const normalizedRoots = paths.map((path) => normalizeRootPath(path));
    const tracks: LocalTrack[] = [];
    const scanErrors: string[] = [];
    const seenPaths = new Set<string>();
    const { skipEntries, cachedTracksByRoot, cachedTrackCount } = buildCachedTrackIndex(normalizedRoots);
    if (cachedTrackCount > 0) {
        localMusicState$.scanTrackTotal.set((value) => Math.max(value, cachedTrackCount));
    }

    const handleBatch = (event: MediaScanBatchEvent) => {
        if (!event || !Array.isArray(event.tracks)) {
            return;
        }

        const rootIndex = event.rootIndex ?? -1;
        const rootPath = normalizedRoots[rootIndex];
        const cachedTracks = cachedTracksByRoot.get(rootIndex);
        if (!rootPath) {
            return;
        }

        for (const nativeTrack of event.tracks) {
            const relativePath = nativeTrack.relativePath?.length
                ? nativeTrack.relativePath
                : (nativeTrack.fileName ?? "");

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

            const cachedTrack = cachedTracks?.get(relativePath);

            const title = nativeTrack.title?.trim() || cachedTrack?.title || fallback.title;
            const artist = nativeTrack.artist?.trim() || cachedTrack?.artist || fallback.artist;
            const album = nativeTrack.album?.trim() || cachedTrack?.album || undefined;

            const durationSeconds =
                Number.isFinite(nativeTrack.durationSeconds) && nativeTrack.durationSeconds != null
                    ? nativeTrack.durationSeconds
                    : undefined;

            const thumbnailKey = nativeTrack.artworkKey?.length
                ? nativeTrack.artworkKey
                : extractThumbnailKeyFromPersisted(cachedTrack);
            const thumbnailUri =
                buildThumbnailUri(thumbnailsDirUri, thumbnailKey) ??
                (nativeTrack.artworkUri?.length ? nativeTrack.artworkUri : cachedTrack?.thumbnail);
            const duration =
                durationSeconds != null ? formatDuration(durationSeconds) : (cachedTrack?.duration ?? "0:00");

            tracks.push({
                id: absolutePath,
                title,
                artist,
                album,
                duration,
                thumbnail: thumbnailUri,
                thumbnailKey,
                filePath: absolutePath,
                fileName,
            });

            seenPaths.add(absolutePath);
        }

        localMusicState$.scanTrackProgress.set(tracks.length);
    };

    const handleProgress = (event: MediaScanProgressEvent) => {
        const totalRoots = event.totalRoots && event.totalRoots > 0 ? event.totalRoots : normalizedRoots.length;
        const completedRoots = Math.min(totalRoots, event.completedRoots ?? event.rootIndex + 1);

        localMusicState$.scanTotal.set(totalRoots);
        localMusicState$.scanProgress.set(completedRoots);
    };

    const handleComplete = (event: MediaScanResult) => {
        const totalRoots = event.totalRoots && event.totalRoots > 0 ? event.totalRoots : normalizedRoots.length;
        const totalTracks = event.totalTracks ?? localMusicState$.scanTrackTotal.get();
        localMusicState$.scanTotal.set(totalRoots);
        localMusicState$.scanProgress.set(totalRoots);
        const finalTotal = Math.max(totalTracks ?? 0, cachedTrackCount, tracks.length);
        localMusicState$.scanTrackTotal.set(finalTotal);
        localMusicState$.scanTrackProgress.set(tracks.length);

        if (Array.isArray(event.errors) && event.errors.length > 0) {
            scanErrors.push(...(event.errors as string[]));
        }
    };

    const subscriptions = [
        AudioPlayer.addListener("onMediaScanBatch", handleBatch),
        AudioPlayer.addListener("onMediaScanProgress", handleProgress),
        AudioPlayer.addListener("onMediaScanComplete", handleComplete),
    ];

    try {
        const result = await AudioPlayer.scanMediaLibrary(normalizedRoots, thumbnailsDirUri, {
            batchSize: 48,
            skip: skipEntries,
        });
        const totalRoots = result.totalRoots && result.totalRoots > 0 ? result.totalRoots : normalizedRoots.length;
        const totalTracks = result.totalTracks ?? localMusicState$.scanTrackTotal.get();
        localMusicState$.scanTotal.set(totalRoots);
        localMusicState$.scanProgress.set(totalRoots);
        localMusicState$.scanTrackTotal.set((value) =>
            Math.max(value, totalTracks ?? 0, cachedTrackCount, tracks.length),
        );
        localMusicState$.scanTrackProgress.set(tracks.length);
        if (Array.isArray(result.errors) && result.errors.length > 0) {
            scanErrors.push(...(result.errors as string[]));
            console.warn("Native library scan completed with errors", {
                errorCount: scanErrors.length,
                totalTracks: result.totalTracks,
                totalRoots,
                sampleErrors: scanErrors.slice(0, 5),
            });
        }
        return { tracks, errors: scanErrors };
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

// Scan all configured library paths
export async function scanLocalMusic(): Promise<void> {
    const paths = Array.from(
        new Set(
            localMusicSettings$.libraryPaths
                .get()
                .map((path) => normalizeRootPath(path))
                .filter(Boolean),
        ),
    );

    if (paths.length === 0) {
        localMusicState$.scanTrackProgress.set(0);
        localMusicState$.scanTrackTotal.set(0);
        localMusicState$.error.set("No library paths configured");
        return;
    }

    const thumbnailsDir = getCacheDirectory("thumbnails");
    ensureCacheDirectory(thumbnailsDir);

    const { existing: availablePaths, missing: missingPaths } = await validateLibraryPaths(paths);
    if (availablePaths.length === 0) {
        localMusicState$.scanTrackProgress.set(0);
        localMusicState$.scanTrackTotal.set(0);
        localMusicState$.error.set("Library folders are unavailable. Please re-add them in Settings and try again.");
        return;
    }

    perfLog("LocalMusic.scanLocalMusic.start", { paths: availablePaths, missingPaths });
    localMusicState$.isScanning.set(true);
    localMusicState$.error.set(missingPaths.length > 0 ? `Skipping missing folders: ${missingPaths.join(", ")}` : null);
    localMusicState$.scanProgress.set(0);
    localMusicState$.scanTotal.set(availablePaths.length);
    localMusicState$.scanTrackProgress.set(0);
    localMusicState$.scanTrackTotal.set(localMusicState$.tracks.get().length);

    try {
        let collectedTracks: LocalTrack[] = [];
        let scanErrors: string[] = [];

        const nativeResult = await scanLibraryNative(availablePaths, thumbnailsDir.uri);
        collectedTracks = nativeResult.tracks;
        scanErrors = nativeResult.errors;

        const dedupedTracks = dedupeTracksByPath(collectedTracks);

        dedupedTracks.sort((a, b) => {
            const artistCompare = a.artist.localeCompare(b.artist);
            if (artistCompare !== 0) return artistCompare;
            return a.title.localeCompare(b.title);
        });

        perfLog("LocalMusic.scanLocalMusic.done", { total: dedupedTracks.length });
        localMusicState$.tracks.set(dedupedTracks);
        localMusicSettings$.lastScanTime.set(Date.now());
        localMusicState$.scanProgress.set(localMusicState$.scanTotal.get());
        localMusicState$.scanTrackProgress.set(dedupedTracks.length);
        localMusicState$.scanTrackTotal.set(dedupedTracks.length);

        if (scanErrors.length > 0) {
            localMusicState$.error.set(
                `Scan completed with ${scanErrors.length} metadata errors. Try rescanning or check file permissions.`,
            );
        }

        debugLocalMusicLog(`Scan complete: Found ${dedupedTracks.length} total MP3 files`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        localMusicState$.error.set(`Scan failed: ${errorMessage}`);
        console.error("Local music scan failed:", error);
    } finally {
        localMusicState$.isScanning.set(false);
    }
}

export function markLibraryChangeUserInitiated(): void {
    pendingUserInitiatedLibraryChange = true;
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

    debugLocalMusicLog("setCurrentPlaylist", playlistId, playlistType);

    // Save current playlist to persistent state
    stateSaved$.assign({
        playlist: playlistId,
        playlistType,
    });
}

stateSaved$.playlist.onChange(({ value }) => {
    debugLocalMusicLog("stateSaved$.playlist.onChange", value);
});
stateSaved$.playlistType.onChange(({ value }) => {
    debugLocalMusicLog("stateSaved$.playlistType.onChange", value);
});

// Initialize and scan on app start
export function initializeLocalMusic(): void {
    const settings = localMusicSettings$.get();

    debugLocalMusicLog("initializeLocalMusic", settings);

    lastLibraryPaths = Array.isArray(settings.libraryPaths) ? [...settings.libraryPaths] : [];
    configureLibraryPathWatcher(lastLibraryPaths);

    if (!hasSubscribedToLibraryPathChanges) {
        hasSubscribedToLibraryPathChanges = true;
        localMusicSettings$.libraryPaths.onChange(({ value }) => {
            const userInitiated = pendingUserInitiatedLibraryChange;
            pendingUserInitiatedLibraryChange = false;

            const nextPaths = Array.isArray(value) ? [...value] : [];
            const removedPaths = lastLibraryPaths.filter((path) => !nextPaths.includes(path));
            if (removedPaths.length > 0) {
                clearCachedLibraryData();
            }
            lastLibraryPaths = nextPaths;
            configureLibraryPathWatcher(nextPaths);

            if (userInitiated && !localMusicState$.isScanning.get()) {
                debugLocalMusicLog("User initiated library change, scanning immediately");
                scanLocalMusic().catch((error) => {
                    console.error("Failed to scan local music after user change:", error);
                });
                return;
            }

            scheduleScanAfterFileChange(userInitiated ? 0 : FILE_WATCH_DEBOUNCE_MS);
        });
    }

    // Restore isLocalFilesSelected state based on saved playlist type
    const savedPlaylistType = stateSaved$.playlistType.get();
    if (savedPlaylistType === "file") {
        const savedPlaylistId = stateSaved$.playlist.get();
        const isLocalFiles = savedPlaylistId === DEFAULT_LOCAL_PLAYLIST_ID;
        localMusicState$.isLocalFilesSelected.set(isLocalFiles);
        if (isLocalFiles) {
            debugLocalMusicLog("Restored default library playlist selection on startup");
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
            debugLocalMusicLog("Deferring auto-scan of local music until idle (cache available)");
            runAfterInteractions(() => {
                debugLocalMusicLog("Auto-scanning local music during idle...");
                scanLocalMusic().catch((error) => {
                    console.error("Failed to auto-scan local music:", error);
                });
            });
        } else {
            debugLocalMusicLog("Auto-scanning local music on startup...");
            scanLocalMusic().catch((error) => {
                console.error("Failed to auto-scan local music:", error);
            });
        }
    }
}
