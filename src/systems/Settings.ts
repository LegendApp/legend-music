import { createJSONManager } from "@/utils/JSONManager";

export type PlaylistStyle = "compact" | "comfortable";

export interface AppSettings {
    state: {
        sidebarWidth: number;
        isSidebarOpen: boolean;
        panels: Record<string, number>;
    };
    general: {
        playlistStyle: PlaylistStyle;
    };
    youtubeMusic: {
        enabled: boolean;
    };
    uniqueId: string;
    isAuthed: boolean;
}

export const settings$ = createJSONManager<AppSettings>({
    filename: "settings",
    initialValue: {
        // State
        state: {
            sidebarWidth: 140,
            isSidebarOpen: true,
            panels: {},
        },
        // General settings
        general: {
            playlistStyle: "comfortable",
        },
        // YouTube Music settings
        youtubeMusic: {
            enabled: true,
        },
        uniqueId: "",
        isAuthed: false,
    },
});
