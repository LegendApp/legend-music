import { registerProviderPlugin, getProviderIdForUri } from "@/providers/pluginRegistry";
import type { Provider, ProviderCapabilities, ProviderSession } from "@/providers/types";

const createTestProvider = (id: string): Provider => {
    const capabilities: ProviderCapabilities = {
        supportsSearch: false,
        supportsLibrary: false,
        supportsPlayback: false,
    };
    const session: ProviderSession = {
        isAuthenticated: false,
    };

    return {
        id,
        name: "Test Provider",
        capabilities,
        async initialize() {
            return;
        },
        teardown() {
            return;
        },
        getSession() {
            return session;
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
};

describe("pluginRegistry", () => {
    it("detects provider ids from track URIs", () => {
        const providerId = "test-plugin-registry";
        const provider = createTestProvider(providerId);

        registerProviderPlugin({
            provider,
            tracks: {
                isUri: (value) => value.startsWith("test://"),
            },
        });

        expect(getProviderIdForUri("test://track/1")).toBe(providerId);
        expect(getProviderIdForUri("file:///music/track.mp3")).toBeNull();
    });
});
