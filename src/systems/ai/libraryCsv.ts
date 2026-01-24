import * as FileSystemNext from "expo-file-system/next";
import { ensureCacheDirectory, getCacheDirectory } from "@/utils/cacheDirectories";
import { settings$ } from "@/systems/Settings";
import { timeoutOnce } from "@/utils/timeoutOnce";
import type { LibrarySnapshot } from "@/systems/LibraryCache";

const MEDIA_LIBRARY_CSV_FILENAME = "medialibrary.csv";
const MEDIA_LIBRARY_HEADERS = ["artist", "title", "album", "year", "genre"] as const;
const MEDIA_LIBRARY_CSV_DEBOUNCE_MS = 500;
const MEDIA_LIBRARY_CSV_TIMEOUT = "mediaLibraryCsvWrite";

let pendingSnapshot: LibrarySnapshot | null = null;
let csvSyncInitialized = false;

const sanitizeCsvValue = (value: string): string => value.replace(/\r?\n/g, " ").trim();

const escapeCsvValue = (value: string): string => {
    const sanitized = sanitizeCsvValue(value);
    if (!/[",\n]/.test(sanitized)) {
        return sanitized;
    }

    const escaped = sanitized.replace(/"/g, '""');
    return `"${escaped}"`;
};

const formatCsvRow = (values: string[]): string => values.map(escapeCsvValue).join(",");

export const buildMediaLibraryCsv = (snapshot: LibrarySnapshot): string => {
    const lines = [MEDIA_LIBRARY_HEADERS.join(",")];

    for (const track of snapshot.tracks) {
        lines.push(
            formatCsvRow([
                track.artist ?? "",
                track.title ?? "",
                track.album ?? "",
                "",
                "",
            ]),
        );
    }

    return lines.join("\n");
};

export const getMediaLibraryCsvFile = (): FileSystemNext.File => {
    const directory = getCacheDirectory("data");
    return new FileSystemNext.File(directory, MEDIA_LIBRARY_CSV_FILENAME);
};

export const writeMediaLibraryCsv = async (snapshot: LibrarySnapshot): Promise<void> => {
    const file = getMediaLibraryCsvFile();
    ensureCacheDirectory(file.parentDirectory);
    await file.write(buildMediaLibraryCsv(snapshot));
};

export const readMediaLibraryCsv = (): string => {
    const file = getMediaLibraryCsvFile();
    if (!file.exists) {
        return "";
    }

    return file.text();
};

const isAiPlaylistGenerationEnabled = (): boolean => {
    const aiSettings = settings$.ai.get();
    return aiSettings.enabled;
};

export const scheduleMediaLibraryCsvUpdate = (snapshot: LibrarySnapshot): void => {
    pendingSnapshot = snapshot;
    if (!isAiPlaylistGenerationEnabled()) {
        return;
    }

    timeoutOnce(
        MEDIA_LIBRARY_CSV_TIMEOUT,
        async () => {
            if (!pendingSnapshot || !isAiPlaylistGenerationEnabled()) {
                return;
            }

            try {
                await writeMediaLibraryCsv(pendingSnapshot);
            } catch (error) {
                console.warn("Failed to update media library CSV", error);
            }
        },
        MEDIA_LIBRARY_CSV_DEBOUNCE_MS,
    );
};

export const initializeMediaLibraryCsvSync = (getSnapshot: () => LibrarySnapshot): void => {
    if (csvSyncInitialized) {
        return;
    }

    csvSyncInitialized = true;

    const handleSettingsChange = () => {
        if (!isAiPlaylistGenerationEnabled()) {
            return;
        }
        scheduleMediaLibraryCsvUpdate(getSnapshot());
    };

    settings$.ai.enabled.onChange(handleSettingsChange);

    if (isAiPlaylistGenerationEnabled()) {
        scheduleMediaLibraryCsvUpdate(getSnapshot());
    }
};
