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
NativeModules.WindowControls = {
    minimize: jest.fn(),
    maximize: jest.fn(),
    close: jest.fn(),
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
}));

jest.mock("expo-file-system", () => ({
    __esModule: true,
    getInfoAsync: jest.fn(async () => ({ exists: true })),
}));

jest.mock("expo-file-system/next", () => {
    const Paths = {
        cache: "/tmp/cache",
    };

    class MockDirectory {
        constructor(base = "", name = "") {
            this.path = [typeof base === "string" ? base : base.path, name].filter(Boolean).join("/");
            this.exists = true;
        }

        get parentDirectory() {
            return this;
        }

        list() {
            return [];
        }
    }

    class MockFile extends MockDirectory {
        constructor(base, name = "") {
            super(base, name);
            this.name = name;
        }

        get exists() {
            return true;
        }

        text() {
            return "";
        }

        bytes() {
            return new Uint8Array();
        }

        delete() {}
    }

    return {
        __esModule: true,
        Directory: MockDirectory,
        File: MockFile,
        Paths,
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
