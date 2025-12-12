if (!process.env.EXPO_OS) {
    process.env.EXPO_OS = "macos";
}

const { NativeModules } = require("react-native");

const mockAudioPlayer = {
    loadTrack: jest.fn().mockResolvedValue({ success: true }),
    play: jest.fn().mockResolvedValue({ success: true }),
    pause: jest.fn().mockResolvedValue({ success: true }),
    stop: jest.fn().mockResolvedValue({ success: true }),
    seek: jest.fn().mockResolvedValue({ success: true }),
    setVolume: jest.fn().mockResolvedValue({ success: true }),
    getCurrentState: jest.fn().mockResolvedValue({
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
    }),
    getMediaTags: jest.fn().mockResolvedValue({}),
    updateNowPlayingInfo: jest.fn(),
    clearNowPlayingInfo: jest.fn(),
};

const mockAudioPlayerWithEvents = {
    ...mockAudioPlayer,
    addListener: jest.fn(() => ({ remove: jest.fn() })),
};

NativeModules.AudioPlayer = mockAudioPlayerWithEvents;
NativeModules.KeyboardManager = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListeners: jest.fn(),
    removeAllListeners: jest.fn(),
    removeListener: jest.fn(),
};
NativeModules.AppExit = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListeners: jest.fn(),
    completeExit: jest.fn(),
};
NativeModules.FileSystemWatcher = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListeners: jest.fn(),
    setWatchedDirectories: jest.fn(),
    isWatchingDirectory: jest.fn(async () => false),
};
NativeModules.WindowControls = {
    minimize: jest.fn(),
    maximize: jest.fn(),
    close: jest.fn(),
    hideWindowControls: jest.fn(async () => {}),
    showWindowControls: jest.fn(async () => {}),
    isWindowFullScreen: jest.fn(async () => false),
};
const mockWindowControls = NativeModules.WindowControls;
NativeModules.WindowManager = {
    getConstants: jest.fn(() => ({})),
    setMinimumSize: jest.fn(),
    setMaximumSize: jest.fn(),
    setCanResize: jest.fn(),
};
const mockWindowManager = NativeModules.WindowManager;

jest.mock("@/native-modules/AudioPlayer", () => ({
    __esModule: true,
    useAudioPlayer: () => ({
        ...mockAudioPlayerWithEvents,
    }),
    default: mockAudioPlayerWithEvents,
    AudioPlayer: mockAudioPlayerWithEvents,
}));

jest.mock("@/native-modules/WindowControls", () => ({
    __esModule: true,
    default: mockWindowControls,
}));

jest.mock("@/native-modules/WindowManager", () => ({
    __esModule: true,
    default: mockWindowManager,
    useWindowManager: () => ({
        openWindow: jest.fn(async () => ({ success: true })),
        closeWindow: jest.fn(async () => ({ success: true })),
        closeFrontmostWindow: jest.fn(async () => ({ success: true })),
        getMainWindowFrame: jest.fn(async () => ({ x: 0, y: 0, width: 0, height: 0 })),
        setMainWindowFrame: jest.fn(async () => ({ success: true })),
        setWindowBlur: jest.fn(async () => ({ success: true })),
        onWindowClosed: jest.fn(() => ({ remove: jest.fn() })),
        onWindowFocused: jest.fn(() => ({ remove: jest.fn() })),
    }),
    openWindow: jest.fn(async () => ({ success: true })),
    closeWindow: jest.fn(async () => ({ success: true })),
    closeFrontmostWindow: jest.fn(async () => ({ success: true })),
    WindowStyleMask: {
        Borderless: "Borderless",
        Titled: "Titled",
        Closable: "Closable",
        Miniaturizable: "Miniaturizable",
        Resizable: "Resizable",
        UnifiedTitleAndToolbar: "UnifiedTitleAndToolbar",
        FullScreen: "FullScreen",
        FullSizeContentView: "FullSizeContentView",
        UtilityWindow: "UtilityWindow",
        DocModalWindow: "DocModalWindow",
        NonactivatingPanel: "NonactivatingPanel",
    },
}));

jest.mock("expo-file-system", () => ({
    __esModule: true,
    getInfoAsync: jest.fn(async () => ({ exists: true })),
}));

jest.mock("expo-file-system/next", () => {
    const fileContents = new Map();
    const directories = new Set();

    const normalizePath = (input) => {
        if (!input) {
            return "/";
        }
        const withoutProtocol = String(input).startsWith("file://") ? String(input).replace("file://", "") : String(input);
        const collapsed = withoutProtocol.replace(/\/+/g, "/");
        if (collapsed === "/") {
            return "/";
        }
        const trimmed = collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
        return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    };

    const resolvePath = (base, name = "") => {
        const basePath = base && typeof base === "object" && "path" in base ? base.path : base;
        const resolved = [basePath, name].filter(Boolean).join("/");
        return normalizePath(resolved);
    };

    const parentPath = (path) => {
        const normalized = normalizePath(path);
        if (normalized === "/") {
            return "/";
        }
        const parts = normalized.split("/").filter(Boolean);
        return parts.length <= 1 ? "/" : `/${parts.slice(0, -1).join("/")}`;
    };

    class MockDirectory {
        constructor(base = "", name = "") {
            this.path = resolvePath(base, name);
            this.uri = `file://${this.path}`;
            this.name = this.path === "/" ? "/" : this.path.split("/").pop();
        }

        get exists() {
            return directories.has(this.path);
        }

        get parentDirectory() {
            return new MockDirectory(parentPath(this.path));
        }

        create() {
            directories.add(this.path);
        }

        list() {
            const dirPath = this.path;
            const entries = [];

            for (const dir of directories) {
                if (dir !== dirPath && parentPath(dir) === dirPath) {
                    entries.push(new MockDirectory(dir));
                }
            }

            for (const filePath of fileContents.keys()) {
                if (parentPath(filePath) === dirPath) {
                    entries.push(new MockFile(filePath));
                }
            }

            return entries;
        }
    }

    class MockFile {
        constructor(base = "", name = "") {
            if (name) {
                this.path = resolvePath(base, name);
            } else {
                this.path = normalizePath(base);
            }

            this.uri = `file://${this.path}`;
            this.name = this.path.split("/").pop();
        }

        get exists() {
            return fileContents.has(this.path);
        }

        get parentDirectory() {
            return new MockDirectory(parentPath(this.path));
        }

        create() {
            this.parentDirectory.create();
            fileContents.set(this.path, fileContents.get(this.path) ?? "");
        }

        write(content = "") {
            this.parentDirectory.create();
            fileContents.set(this.path, String(content));
        }

        text() {
            return fileContents.get(this.path) ?? "";
        }

        bytes() {
            return new Uint8Array();
        }

        delete() {
            fileContents.delete(this.path);
        }
    }

    const cacheDirectory = new MockDirectory("/tmp/cache");
    cacheDirectory.create();
    const documentDirectory = new MockDirectory("/tmp/document");
    documentDirectory.create();

    return {
        __esModule: true,
        Directory: MockDirectory,
        File: MockFile,
        Paths: {
            cache: cacheDirectory,
            document: documentDirectory,
        },
        __setMockFile(path, content) {
            const normalized = normalizePath(path);
            new MockFile(normalized).write(content);
        },
        __resetMockFileSystem() {
            fileContents.clear();
            directories.clear();
            cacheDirectory.create();
            documentDirectory.create();
        },
    };
});


jest.mock("react-native-reanimated", () => {
    const ReactNative = require("react-native");

    return {
        __esModule: true,
        default: {
            View: ReactNative.View,
        },
        useSharedValue: jest.fn((initial) => ({ value: initial })),
        useAnimatedStyle: jest.fn((fn) => (fn ? fn() : {})),
        withTiming: jest.fn((value) => value),
        withSpring: jest.fn((value) => value),
        runOnJS: jest.fn((fn) => fn),
    };
});


jest.mock("@legendapp/motion", () => ({
    __esModule: true,
    AnimatePresence: ({ children }) => children,
    Motion: {
        View: () => null,
    },
}));

jest.mock("@/utils/ExpoFSPersistPlugin", () => {
    const plugin = {
        initialize: jest.fn(),
        getTable: (_table, init) => init ?? {},
        getMetadata: () => ({}),
        set: jest.fn(async () => {}),
        setMetadata: jest.fn(async () => {}),
        deleteTable: jest.fn(),
        deleteMetadata: jest.fn(),
        flush: jest.fn(async () => {}),
    };

    return {
        __esModule: true,
        observablePersistExpoFS: jest.fn(() => plugin),
    };
});

jest.mock("@legendapp/list", () => {
    const React = require("react");
    return {
        __esModule: true,
        LegendList: React.forwardRef(() => null),
    };
});

jest.mock("@shopify/react-native-skia", () => ({
    __esModule: true,
    Canvas: () => null,
    Rect: () => null,
    Shader: () => null,
    Skia: {
        RuntimeEffect: {
            Make: () => null,
        },
    },
}));
