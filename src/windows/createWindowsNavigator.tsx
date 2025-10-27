import React, { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { AppRegistry } from "react-native";

import {
    closeWindow as nativeCloseWindow,
    openWindow as nativeOpenWindow,
    type WindowOptions,
} from "@/native-modules/WindowManager";
import type { WindowConfigEntry, WindowsConfig } from "./types";
import { withWindowProvider } from "./WindowProvider";

type WindowOpenOverrides = Omit<WindowOptions, "identifier" | "moduleName">;

type RegisteredWindow = {
    identifier: string;
    options: WindowOptions;
    ensureComponent: () => Promise<void>;
};

export type WindowsNavigator<TConfig extends WindowsConfig> = {
    open: (window: keyof TConfig, overrides?: WindowOpenOverrides) => Promise<void>;
    close: (window: keyof TConfig) => Promise<void>;
    getIdentifier: (window: keyof TConfig) => string;
    prefetch: (window: keyof TConfig) => Promise<void>;
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

        if (!entry.component && !entry.loadComponent) {
            throw new Error(`Window '${moduleName}' must supply either 'component' or 'loadComponent'.`);
        }

        let cachedComponent: ComponentType<any> | null = entry.component
            ? withWindowProvider(entry.component, identifier)
            : null;

        let componentPromise: Promise<ComponentType<any>> | null = entry.component
            ? Promise.resolve(cachedComponent as ComponentType<any>)
            : null;

        const resolveComponent = async (): Promise<ComponentType<any>> => {
            if (cachedComponent) {
                return cachedComponent;
            }

            if (!componentPromise) {
                componentPromise = Promise.resolve(entry.loadComponent!()).then((loaded) => {
                    const resolved =
                        typeof loaded === "function"
                            ? (loaded as ComponentType<any>)
                            : loaded && typeof loaded === "object" && "default" in loaded
                              ? ((loaded as { default: ComponentType<any> }).default as ComponentType<any>)
                              : (loaded as ComponentType<any>);

                    cachedComponent = withWindowProvider(resolved, identifier);
                    return cachedComponent;
                });
            }

            const component = await componentPromise;
            if (!cachedComponent) {
                cachedComponent = component;
            }
            return component;
        };

        AppRegistry.registerComponent(moduleName, () => {
            const LazyWindow = (props: any) => {
                const [Component, setComponent] = useState<ComponentType<any> | null>(cachedComponent);

                useEffect(() => {
                    let mounted = true;
                    if (!Component) {
                        resolveComponent().then((resolved) => {
                            if (mounted) {
                                setComponent(() => resolved);
                            }
                        });
                    }

                    return () => {
                        mounted = false;
                    };
                }, [Component]);

                if (!Component) {
                    return null;
                }

                return <Component {...props} />;
            };

            return LazyWindow;
        });

        registry.set(key, {
            identifier,
            options: normalizeWindowOptions(moduleName, identifier, entry),
            ensureComponent: async () => {
                await resolveComponent();
            },
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
        await registration.ensureComponent();
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

    const prefetch = async (windowKey: keyof TConfig) => {
        const registration = ensureRegistration(windowKey);
        await registration.ensureComponent();
    };

    return {
        open,
        close,
        getIdentifier,
        prefetch,
    } satisfies WindowsNavigator<TConfig>;
}
