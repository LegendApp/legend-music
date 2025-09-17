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
    registration: {
        isRegistered: boolean;
        registrationType?: 'legendkit' | 'standalone';
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
        // Registration settings
        registration: {
            isRegistered: false,
        },
        uniqueId: "",
        isAuthed: false,
    },
});
