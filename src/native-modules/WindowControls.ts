import { NativeEventEmitter, NativeModules } from "react-native";

const { WindowControls } = NativeModules;

if (!WindowControls) {
    throw new Error("WindowControls native module is not available");
}

type WindowControlsType = {
    hideWindowControls: () => Promise<void>;
    showWindowControls: () => Promise<void>;
    isWindowFullScreen: () => Promise<boolean>;
};

const windowControlsEmitter = new NativeEventEmitter(WindowControls);

export const useWindowControls = (): WindowControlsType & {
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => { remove: () => void };
} => {
    return {
        hideWindowControls: () => WindowControls.hideWindowControls(),
        showWindowControls: () => WindowControls.showWindowControls(),
        isWindowFullScreen: () => WindowControls.isWindowFullScreen(),
        onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
            const subscription = windowControlsEmitter.addListener("fullscreenChange", callback);
            return {
                remove: () => subscription.remove(),
            };
        },
    };
};

export default WindowControls as WindowControlsType;
