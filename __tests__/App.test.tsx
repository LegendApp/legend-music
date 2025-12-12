/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";

jest.mock("@/components/MainContainer", () => ({
    __esModule: true,
    MainContainer: () => null,
}));

jest.mock("@/components/TitleBar", () => ({
    __esModule: true,
    TitleBar: () => null,
}));

jest.mock("@/media-library/MediaLibraryWindowManager", () => ({
    __esModule: true,
    MediaLibraryWindowManager: () => null,
}));

jest.mock("@/settings/SettingsWindowManager", () => ({
    __esModule: true,
    SettingsWindowManager: () => null,
}));

jest.mock("@/overlay/CurrentSongOverlayWindowManager", () => ({
    __esModule: true,
    CurrentSongOverlayWindowManager: () => null,
}));

jest.mock("@/overlay/CurrentSongOverlayController", () => ({
    __esModule: true,
    CurrentSongOverlayController: () => null,
}));

jest.mock("@/visualizer/VisualizerWindowManager", () => ({
    __esModule: true,
    VisualizerWindowManager: () => null,
}));

jest.mock("@/systems/keyboard/HookKeyboard", () => ({
    __esModule: true,
    HookKeyboard: () => null,
}));

jest.mock("@/systems/Updater", () => ({
    __esModule: true,
    initializeUpdater: jest.fn(),
}));

jest.mock("@/systems/MenuManager", () => ({
    __esModule: true,
    initializeMenuManager: jest.fn(),
}));

jest.mock("@/systems/LocalMusicState", () => ({
    __esModule: true,
    initializeLocalMusic: jest.fn(),
}));

jest.mock("@/systems/LibraryState", () => ({
    __esModule: true,
    hydrateLibraryFromCache: jest.fn(),
}));

jest.mock("@/utils/runAfterInteractions", () => ({
    __esModule: true,
    runAfterInteractionsWithLabel: () => ({ cancel: jest.fn() }),
}));

jest.mock("@/windows", () => ({
    __esModule: true,
    WindowsNavigator: {
        prefetch: jest.fn(async () => {}),
    },
}));

jest.mock("@/windows/WindowProvider", () => {
    const React = require("react");
    return {
        __esModule: true,
        WindowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

jest.mock("@fluentui-react-native/vibrancy-view", () => {
    const React = require("react");
    return {
        __esModule: true,
        VibrancyView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

jest.mock("@gorhom/portal", () => {
    const React = require("react");
    return {
        __esModule: true,
        PortalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

import App from "../src/App";

test("renders correctly", async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | null = null;

    await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(<App />);
    });

    await ReactTestRenderer.act(async () => {
        tree?.unmount();
        tree = null;
    });
});
