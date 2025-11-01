import { createJSONManager } from "@/utils/JSONManager";

export type PlaylistStyle = "compact";

export type OverlayVerticalPosition = "top" | "middle" | "bottom";
export type OverlayHorizontalPosition = "left" | "center" | "right";

export const OVERLAY_MIN_DISPLAY_DURATION_SECONDS = 1;
export const OVERLAY_MAX_DISPLAY_DURATION_SECONDS = 30;

export interface OverlaySettingsConfig {
    enabled: boolean;
    displayDurationSeconds: number;
    position: {
        vertical: OverlayVerticalPosition;
        horizontal: OverlayHorizontalPosition;
    };
}

export interface AppSettings {
    state: {
        sidebarWidth: number;
        isSidebarOpen: boolean;
        panels: Record<string, number>;
    };
    general: {
        playlistStyle: PlaylistStyle;
        showHints: boolean;
    };
    registration: {
        isRegistered: boolean;
        registrationType?: "legendkit" | "standalone";
    };
    overlay: OverlaySettingsConfig;
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
            playlistStyle: "compact",
            showHints: true,
        },
        // Registration settings
        registration: {
            isRegistered: false,
        },
        overlay: {
            enabled: true,
            displayDurationSeconds: 2.5,
            position: {
                vertical: "bottom",
                horizontal: "center",
            },
        },
        uniqueId: "",
        isAuthed: false,
    },
});
