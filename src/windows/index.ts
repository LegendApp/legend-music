import { createWindowsNavigator, WindowStyleMask, type WindowsConfig } from "./api";

const windowsConfig = {
    SettingsWindow: {
        loadComponent: () => import("@/settings/SettingsContainer"),
        identifier: "settings",
        options: {
            title: "Settings",
            windowStyle: {
                width: 800,
                height: 800,
                mask: [WindowStyleMask.Titled, WindowStyleMask.Closable, WindowStyleMask.Resizable],
            },
        },
    },
    MediaLibraryWindow: {
        loadComponent: () => import("@/media-library/MediaLibraryWindow"),
        identifier: "media-library",
        options: {
            title: "Media Library",
            windowStyle: {
                width: 600,
                height: 600,
                mask: [WindowStyleMask.Titled, WindowStyleMask.Closable, WindowStyleMask.Resizable],
            },
        },
    },
    CurrentSongOverlayWindow: {
        loadComponent: () => import("@/overlay/CurrentSongOverlayWindow"),
        identifier: "current-song-overlay",
        options: {
            title: "",
            level: "status",
            transparentBackground: true,
            windowStyle: {
                width: 360,
                height: 140,
                mask: [
                    WindowStyleMask.Borderless,
                    WindowStyleMask.NonactivatingPanel,
                    WindowStyleMask.FullSizeContentView,
                ],
                titlebarAppearsTransparent: true,
            },
        },
    },
} satisfies WindowsConfig;

export const WindowsNavigator = createWindowsNavigator(windowsConfig);

export type RegisteredWindow = keyof typeof windowsConfig;

export * from "./api";
