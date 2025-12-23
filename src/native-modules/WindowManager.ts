import { NativeEventEmitter, type NativeModule, NativeModules } from "react-native";

const { WindowManager } = NativeModules;

if (!WindowManager) {
    throw new Error("WindowManager native module is not available");
}

const windowManagerConstants = WindowManager.getConstants?.() ?? {};

export enum WindowStyleMask {
    Borderless = "Borderless",
    Titled = "Titled",
    Closable = "Closable",
    Miniaturizable = "Miniaturizable",
    Resizable = "Resizable",
    UnifiedTitleAndToolbar = "UnifiedTitleAndToolbar",
    FullScreen = "FullScreen",
    FullSizeContentView = "FullSizeContentView",
    UtilityWindow = "UtilityWindow",
    DocModalWindow = "DocModalWindow",
    NonactivatingPanel = "NonactivatingPanel",
}

const windowStyleMaskMap: Record<WindowStyleMask, number> = {
    [WindowStyleMask.Borderless]: windowManagerConstants.STYLE_MASK_BORDERLESS ?? 0,
    [WindowStyleMask.Titled]: windowManagerConstants.STYLE_MASK_TITLED ?? 0,
    [WindowStyleMask.Closable]: windowManagerConstants.STYLE_MASK_CLOSABLE ?? 0,
    [WindowStyleMask.Miniaturizable]: windowManagerConstants.STYLE_MASK_MINIATURIZABLE ?? 0,
    [WindowStyleMask.Resizable]: windowManagerConstants.STYLE_MASK_RESIZABLE ?? 0,
    [WindowStyleMask.UnifiedTitleAndToolbar]: windowManagerConstants.STYLE_MASK_UNIFIED_TITLE_AND_TOOLBAR ?? 0,
    [WindowStyleMask.FullScreen]: windowManagerConstants.STYLE_MASK_FULL_SCREEN ?? 0,
    [WindowStyleMask.FullSizeContentView]: windowManagerConstants.STYLE_MASK_FULL_SIZE_CONTENT_VIEW ?? 0,
    [WindowStyleMask.UtilityWindow]: windowManagerConstants.STYLE_MASK_UTILITY_WINDOW ?? 0,
    [WindowStyleMask.DocModalWindow]: windowManagerConstants.STYLE_MASK_DOC_MODAL_WINDOW ?? 0,
    [WindowStyleMask.NonactivatingPanel]: windowManagerConstants.STYLE_MASK_NONACTIVATING_PANEL ?? 0,
};

export type WindowLevel = "normal" | "floating" | "modalPanel" | "mainMenu" | "status" | "screenSaver";

const windowLevelMap: Partial<Record<WindowLevel, number>> = {
    normal: windowManagerConstants.WINDOW_LEVEL_NORMAL,
    floating: windowManagerConstants.WINDOW_LEVEL_FLOATING,
    modalPanel: windowManagerConstants.WINDOW_LEVEL_MODAL_PANEL,
    mainMenu: windowManagerConstants.WINDOW_LEVEL_MAIN_MENU,
    status: windowManagerConstants.WINDOW_LEVEL_STATUS,
    screenSaver: windowManagerConstants.WINDOW_LEVEL_SCREEN_SAVER,
};

export type WindowStyleOptions = {
    mask?: WindowStyleMask[];
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    titlebarAppearsTransparent?: boolean;
    titleVisibility?: "visible" | "hidden";
    toolbarStyle?: "automatic" | "expanded" | "preference" | "unified" | "unifiedCompact";
    titlebarSeparatorStyle?: "automatic" | "none" | "line" | "shadow";
    hasToolbar?: boolean;
};

export type WindowOptions = {
    identifier?: string;
    moduleName?: string;
    title?: string;
    x?: number;
    y?: number;
    hasShadow?: boolean;
    windowStyle?: WindowStyleOptions;
    initialProperties?: Record<string, unknown>;
    level?: WindowLevel;
    transparentBackground?: boolean;
    animateFrameChange?: boolean;
    frameAnimationDurationMs?: number;
};

type NativeWindowStyleOptions = Omit<WindowStyleOptions, "mask"> & {
    mask?: number;
};

type NativeWindowOptions = Omit<WindowOptions, "windowStyle" | "level"> & {
    windowStyle?: NativeWindowStyleOptions;
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
    level?: number;
};

const convertMaskArrayToBitwise = (mask?: WindowStyleMask[]) => {
    if (!mask || mask.length === 0) {
        return undefined;
    }

    return mask.reduce((result, maskValue) => {
        const nativeMask = windowStyleMaskMap[maskValue];
        return result | nativeMask;
    }, 0);
};

const convertWindowStyleToNative = (windowStyle?: WindowStyleOptions): NativeWindowStyleOptions | undefined => {
    if (!windowStyle) {
        return undefined;
    }

    const { mask, ...rest } = windowStyle;

    return {
        ...rest,
        mask: convertMaskArrayToBitwise(mask),
    };
};

const convertWindowLevelToNative = (level?: WindowLevel) => {
    if (!level) {
        return undefined;
    }

    return windowLevelMap[level];
};

const convertOptionsToNative = (options: WindowOptions = {}): NativeWindowOptions => {
    const { level, windowStyle, animateFrameChange, frameAnimationDurationMs, ...rest } = options;
    const nativeWindowStyle = convertWindowStyleToNative(windowStyle);

    const nativeOptions: NativeWindowOptions = {
        ...rest,
        windowStyle: nativeWindowStyle,
    };

    if (nativeWindowStyle?.width !== undefined) {
        nativeOptions.width = nativeWindowStyle.width;
    }

    if (nativeWindowStyle?.height !== undefined) {
        nativeOptions.height = nativeWindowStyle.height;
    }

    if (nativeWindowStyle?.minWidth !== undefined) {
        nativeOptions.minWidth = nativeWindowStyle.minWidth;
    }

    if (nativeWindowStyle?.minHeight !== undefined) {
        nativeOptions.minHeight = nativeWindowStyle.minHeight;
    }

    const nativeLevel = convertWindowLevelToNative(level);
    if (nativeLevel !== undefined) {
        nativeOptions.level = nativeLevel;
    }

    if (animateFrameChange !== undefined) {
        nativeOptions.animateFrameChange = animateFrameChange;
    }

    if (frameAnimationDurationMs !== undefined) {
        nativeOptions.frameAnimationDurationMs = frameAnimationDurationMs;
    }

    return nativeOptions;
};

export type WindowFrame = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type WindowClosedEvent = {
    identifier: string;
    moduleName?: string;
};

export type WindowFocusedEvent = {
    identifier: string;
    moduleName?: string;
};

type NativeWindowManagerType = NativeModule & {
    openWindow: (options?: NativeWindowOptions) => Promise<{ success: boolean }>;
    closeWindow: (identifier?: string) => Promise<{ success: boolean; message?: string }>;
    closeFrontmostWindow: () => Promise<{ success: boolean; message?: string }>;
    getMainWindowFrame: () => Promise<WindowFrame>;
    setMainWindowFrame: (frame: WindowFrame) => Promise<{ success: boolean }>;
    setWindowBlur: (identifier: string, radius: number, durationMs: number) => Promise<{ success: boolean }>;
    setWindowTitle: (identifier: string, title: string) => Promise<{ success: boolean }>;
};

const windowManagerModule = WindowManager as NativeWindowManagerType;

const windowManagerEmitter = new NativeEventEmitter(windowManagerModule);

export type WindowManagerBridge = {
    openWindow: (options?: WindowOptions) => Promise<{ success: boolean }>;
    closeWindow: (identifier?: string) => Promise<{ success: boolean; message?: string }>;
    closeFrontmostWindow: () => Promise<{ success: boolean; message?: string }>;
    getMainWindowFrame: () => Promise<WindowFrame>;
    setMainWindowFrame: (frame: WindowFrame) => Promise<{ success: boolean }>;
    setWindowBlur: (identifier: string, radius: number, durationMs?: number) => Promise<{ success: boolean }>;
    setWindowTitle: (identifier: string, title: string) => Promise<{ success: boolean }>;
    onWindowClosed: (callback: (event: WindowClosedEvent) => void) => { remove: () => void };
    onWindowFocused: (callback: (event: WindowFocusedEvent) => void) => { remove: () => void };
};

export const useWindowManager = (): WindowManagerBridge => {
    return {
        openWindow: (options = {}) => windowManagerModule.openWindow(convertOptionsToNative(options)),
        closeWindow: (identifier?: string) => windowManagerModule.closeWindow(identifier),
        closeFrontmostWindow: () => windowManagerModule.closeFrontmostWindow(),
        getMainWindowFrame: () => windowManagerModule.getMainWindowFrame(),
        setMainWindowFrame: (frame: WindowFrame) => windowManagerModule.setMainWindowFrame(frame),
        setWindowBlur: (identifier: string, radius: number, durationMs?: number) =>
            windowManagerModule.setWindowBlur(identifier, radius, durationMs ?? 0),
        setWindowTitle: (identifier: string, title: string) => windowManagerModule.setWindowTitle(identifier, title),
        onWindowClosed: (callback: (event: WindowClosedEvent) => void) => {
            const subscription = windowManagerEmitter.addListener("onWindowClosed", callback);
            return {
                remove: () => subscription.remove(),
            };
        },
        onWindowFocused: (callback: (event: WindowFocusedEvent) => void) => {
            const subscription = windowManagerEmitter.addListener("onWindowFocused", callback);
            return {
                remove: () => subscription.remove(),
            };
        },
    };
};

export const openWindow = (options: WindowOptions = {}) =>
    windowManagerModule.openWindow(convertOptionsToNative(options));

export const closeWindow = (identifier?: string) => windowManagerModule.closeWindow(identifier);

export const closeFrontmostWindow = () => windowManagerModule.closeFrontmostWindow();

export const setWindowBlur = (identifier: string, radius: number, durationMs?: number) =>
    windowManagerModule.setWindowBlur(identifier, radius, durationMs ?? 0);

export const setWindowTitle = (identifier: string, title: string) =>
    windowManagerModule.setWindowTitle(identifier, title);

export default windowManagerModule;
