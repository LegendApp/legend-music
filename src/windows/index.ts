import { MediaLibraryWindow } from "@/media-library/MediaLibraryWindow";
import { SettingsContainer } from "@/settings/SettingsContainer";

import { createWindowsNavigator, WindowStyleMask, type WindowsConfig } from "./api";

const windowsConfig = {
    SettingsWindow: {
        component: SettingsContainer,
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
        component: MediaLibraryWindow,
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
} satisfies WindowsConfig;

export const WindowsNavigator = createWindowsNavigator(windowsConfig);

export type RegisteredWindow = keyof typeof windowsConfig;

export * from "./api";
