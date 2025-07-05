import { NativeEventEmitter, NativeModules } from "react-native";

const { WindowManager } = NativeModules;

if (!WindowManager) {
    throw new Error("WindowManager native module is not available");
}

export type WindowOptions = {
    title?: string;
    width?: number;
    height?: number;
};

export type WindowFrame = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type WindowManagerType = {
    openWindow: (options?: WindowOptions) => Promise<{ success: boolean }>;
    closeWindow: () => Promise<{ success: boolean; message?: string }>;
    getMainWindowFrame: () => Promise<WindowFrame>;
    setMainWindowFrame: (frame: WindowFrame) => Promise<{ success: boolean }>;
};

const windowManagerEmitter = new NativeEventEmitter(WindowManager);

export const useWindowManager = (): WindowManagerType & {
    onWindowClosed: (callback: () => void) => { remove: () => void };
} => {
    return {
        openWindow: (options = {}) => WindowManager.openWindow(options),
        closeWindow: WindowManager.closeWindow,
        getMainWindowFrame: WindowManager.getMainWindowFrame,
        setMainWindowFrame: (frame: WindowFrame) => WindowManager.setMainWindowFrame(frame),
        onWindowClosed: (callback: () => void) => {
            const subscription = windowManagerEmitter.addListener("onWindowClosed", callback);
            return {
                remove: () => subscription.remove(),
            };
        },
    };
};

export default WindowManager as WindowManagerType;
