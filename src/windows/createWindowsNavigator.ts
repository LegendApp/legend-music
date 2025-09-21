import { AppRegistry } from "react-native";

import {
    closeWindow as nativeCloseWindow,
    openWindow as nativeOpenWindow,
    type WindowOptions,
} from "@/native-modules/WindowManager";

import { withWindowProvider } from "./WindowProvider";
import type { WindowConfigEntry, WindowsConfig } from "./types";

type WindowOpenOverrides = Omit<WindowOptions, "identifier" | "moduleName">;

type RegisteredWindow = {
    identifier: string;
    options: WindowOptions;
};

export type WindowsNavigator<TConfig extends WindowsConfig> = {
    open: (window: keyof TConfig, overrides?: WindowOpenOverrides) => Promise<void>;
    close: (window: keyof TConfig) => Promise<void>;
    getIdentifier: (window: keyof TConfig) => string;
};

const cloneInitialProperties = (initialProperties?: Record<string, unknown>) => {
    if (!initialProperties) {
        return undefined;
    }

    return { ...initialProperties };
};

const normalizeWindowOptions = (moduleName: string, identifier: string, entry?: WindowConfigEntry): WindowOptions => {
    const baseOptions = entry?.options ? { ...entry.options } : {};
    const baseWindowStyle = baseOptions.windowStyle ? { ...baseOptions.windowStyle } : undefined;
    const baseInitialProps = cloneInitialProperties(baseOptions.initialProperties);

    return {
        ...baseOptions,
        identifier,
        moduleName,
        windowStyle: baseWindowStyle,
        initialProperties: baseInitialProps,
    } satisfies WindowOptions;
};

const mergeWindowOptions = (baseOptions: WindowOptions, overrides?: WindowOpenOverrides): WindowOptions => {
    if (!overrides) {
        return { ...baseOptions, windowStyle: baseOptions.windowStyle ? { ...baseOptions.windowStyle } : undefined };
    }

    const mergedWindowStyle = {
        ...(baseOptions.windowStyle ?? {}),
        ...(overrides.windowStyle ?? {}),
    };

    const hasWindowStyle = Object.keys(mergedWindowStyle).length > 0;

    const mergedInitialProps = overrides.initialProperties
        ? { ...(baseOptions.initialProperties ?? {}), ...overrides.initialProperties }
        : baseOptions.initialProperties
          ? { ...baseOptions.initialProperties }
          : undefined;

    return {
        ...baseOptions,
        ...overrides,
        identifier: baseOptions.identifier,
        moduleName: baseOptions.moduleName,
        windowStyle: hasWindowStyle ? mergedWindowStyle : undefined,
        initialProperties: mergedInitialProps,
    } satisfies WindowOptions;
};

export function createWindowsNavigator<TConfig extends WindowsConfig>(config: TConfig) {
    const registry = new Map<keyof TConfig, RegisteredWindow>();

    (Object.keys(config) as Array<keyof TConfig>).forEach((key) => {
        const moduleName = String(key);
        const entry = config[key];
        const identifier = entry.identifier ?? moduleName;

        AppRegistry.registerComponent(moduleName, () => withWindowProvider(entry.component, identifier));

        registry.set(key, {
            identifier,
            options: normalizeWindowOptions(moduleName, identifier, entry),
        });
    });

    const ensureRegistration = (windowKey: keyof TConfig) => {
        const registration = registry.get(windowKey);
        if (!registration) {
            throw new Error(`Window '${String(windowKey)}' is not registered.`);
        }
        return registration;
    };

    const open = async (windowKey: keyof TConfig, overrides?: WindowOpenOverrides) => {
        const registration = ensureRegistration(windowKey);
        const { options } = registration;
        const mergedOptions = mergeWindowOptions(options, overrides);

        const result = await nativeOpenWindow(mergedOptions);
        if (!result?.success) {
            throw new Error(`Failed to open window '${String(windowKey)}'.`);
        }
    };

    const close = async (windowKey: keyof TConfig) => {
        const registration = ensureRegistration(windowKey);
        const result = await nativeCloseWindow(registration.identifier);
        if (!result?.success && result?.message && result.message !== "No window to close") {
            throw new Error(result.message);
        }
    };

    const getIdentifier = (windowKey: keyof TConfig) => ensureRegistration(windowKey).identifier;

    return {
        open,
        close,
        getIdentifier,
    } satisfies WindowsNavigator<TConfig>;
}
