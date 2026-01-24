import type {
    StreamingProvider,
    StreamingProviderCapabilities,
    StreamingProviderInitOptions,
    StreamingProviderSession,
} from "./types";

const capabilities: StreamingProviderCapabilities = {
    supportsSearch: true,
    supportsLibrary: true,
    supportsPlayback: true,
    requiresPremium: false,
    requiresWebView: false,
};

const localSession: StreamingProviderSession = {
    isAuthenticated: true,
    userDisplayName: "Local files",
};

export const localProvider: StreamingProvider = {
    id: "local",
    name: "Local Files",
    capabilities,
    async initialize(_: StreamingProviderInitOptions = {}) {
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
