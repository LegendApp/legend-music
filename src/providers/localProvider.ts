import type { Provider, ProviderCapabilities, ProviderInitOptions, ProviderSession } from "./types";

const capabilities: ProviderCapabilities = {
    supportsSearch: false,
    supportsLibrary: false,
    supportsPlayback: true,
    requiresPremium: false,
    requiresWebView: false,
};

const localSession: ProviderSession = {
    isAuthenticated: true,
    userDisplayName: "Local files",
};

export const localProvider: Provider = {
    id: "local",
    name: "Local Files",
    capabilities,
    async initialize(_: ProviderInitOptions = {}) {
        return;
    },
    teardown() {
        return;
    },
    getSession() {
        return localSession;
    },
    async login() {
        return { authorizeUrl: "", state: "" };
    },
    async completeLogin() {
        return;
    },
    async logout() {
        return;
    },
    async refresh() {
        return;
    },
};
