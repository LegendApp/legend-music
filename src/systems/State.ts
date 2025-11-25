import { observable } from "@legendapp/state";
import type { SettingsPage } from "@/settings/SettingsContainer";
import { File } from "expo-file-system/next";
import { createJSONManager } from "@/utils/JSONManager";
import { getCacheDirectory } from "@/utils/cacheDirectories";

export const state$ = observable({
    isDropdownOpen: false,
    activeSubmenuId: null as string | null,
    lastNavStart: 0,
    lastNavTime: 0,
    titleBarHovered: false,
    showSettings: false,
    showSettingsPage: undefined as SettingsPage | undefined,
    songId: undefined as string | undefined,
    listeningForKeyPress: false,
});

type SavedState = {
    playlist: string | undefined;
    playlistType: "file" | "url";
};

const loadLegacySavedState = (): Partial<SavedState> => {
    try {
        const legacyFile = new File(getCacheDirectory("data"), "settings.json");
        if (!legacyFile.exists) {
            return {};
        }
        const parsed = JSON.parse(legacyFile.text()) as Partial<SavedState>;
        const playlistType = parsed?.playlistType === "url" ? "url" : parsed?.playlistType === "file" ? "file" : undefined;
        return {
            playlist: typeof parsed?.playlist === "string" ? parsed.playlist : undefined,
            playlistType,
        };
    } catch {
        return {};
    }
};

const legacyState = loadLegacySavedState();

export const stateSaved$ = createJSONManager({
    filename: "stateSaved",
    initialValue: {
        playlist: legacyState.playlist ?? undefined,
        playlistType: legacyState.playlistType ?? ("file" as const),
    },
});
