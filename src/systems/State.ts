import { observable } from "@legendapp/state";
import type { SettingsPage } from "@/settings/SettingsContainer";
import { createJSONManager } from "@/utils/JSONManager";

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

export const stateSaved$ = createJSONManager<SavedState>({
    filename: "stateSaved",
    initialValue: {
        playlist: undefined as string | undefined,
        playlistType: "file" as const,
    },
});
