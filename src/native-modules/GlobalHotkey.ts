import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import type { KeyboardEventCodeHotkey } from "@/systems/keyboard/Keyboard";
import { KeyCodes } from "@/systems/keyboard/KeyboardManager";

type GlobalHotkeyResult = { success: boolean; message?: string };

type NativeGlobalHotkey = {
    registerHotkey: (keyCode: number, modifiers: number) => Promise<GlobalHotkeyResult>;
    unregisterHotkey: () => Promise<GlobalHotkeyResult>;
};

const nativeGlobalHotkey = NativeModules.GlobalHotkey as NativeGlobalHotkey | undefined;
const isSupported = Platform.OS === "macos" && !!nativeGlobalHotkey;
const eventEmitter = isSupported ? new NativeEventEmitter(nativeGlobalHotkey as NativeGlobalHotkey) : null;

const MODIFIER_CODES = new Set<number>([
    KeyCodes.MODIFIER_COMMAND,
    KeyCodes.MODIFIER_SHIFT,
    KeyCodes.MODIFIER_OPTION,
    KeyCodes.MODIFIER_CONTROL,
    KeyCodes.MODIFIER_CAPS_LOCK,
    KeyCodes.MODIFIER_FUNCTION,
]);

const parseHotkey = (value: KeyboardEventCodeHotkey | null) => {
    if (!value) {
        return null;
    }

    const codes = `${value}`
        .split("+")
        .map((segment) => Number(segment.trim()))
        .filter((code) => Number.isFinite(code));

    if (codes.length === 0) {
        return null;
    }

    const modifiers = codes.filter((code) => MODIFIER_CODES.has(code));
    const keys = codes.filter((code) => !MODIFIER_CODES.has(code));
    const keyCode = keys.length > 0 ? keys[keys.length - 1] : null;

    if (keyCode === null) {
        return null;
    }

    const modifierMask = modifiers.reduce((mask, code) => mask | code, 0);

    return { keyCode, modifiers: modifierMask };
};

export const registerGlobalHotkey = async (
    value: KeyboardEventCodeHotkey | null,
): Promise<GlobalHotkeyResult> => {
    if (!isSupported || !nativeGlobalHotkey) {
        return { success: true };
    }

    if (!value) {
        return nativeGlobalHotkey.unregisterHotkey();
    }

    const parsed = parseHotkey(value);
    if (!parsed) {
        return { success: false, message: "No valid hotkey found." };
    }

    if (parsed.keyCode < 0 || parsed.keyCode > 255) {
        return { success: false, message: "Unsupported hotkey key." };
    }

    return nativeGlobalHotkey.registerHotkey(parsed.keyCode, parsed.modifiers);
};

export const unregisterGlobalHotkey = async (): Promise<GlobalHotkeyResult> => {
    if (!isSupported || !nativeGlobalHotkey) {
        return { success: true };
    }

    return nativeGlobalHotkey.unregisterHotkey();
};

export const onGlobalHotkey = (callback: () => void) => {
    if (!eventEmitter) {
        return { remove: () => {} };
    }

    const subscription = eventEmitter.addListener("onHotkeyPressed", () => {
        callback();
    });

    return {
        remove: () => subscription.remove(),
    };
};
