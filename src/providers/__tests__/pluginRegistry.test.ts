import { registerStreamingProviderPlugin, getStreamingProviderIdForUri } from "@/providers/pluginRegistry";
import type { StreamingProvider, StreamingProviderCapabilities, StreamingProviderSession } from "@/providers/types";

const createTestProvider = (id: string): StreamingProvider => {
    const capabilities: StreamingProviderCapabilities = {
        supportsSearch: false,
        supportsLibrary: false,
        supportsPlayback: false,
    };
    const session: StreamingProviderSession = {
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

        registerStreamingProviderPlugin({
            provider,
            tracks: {
                isUri: (value) => value.startsWith("test://"),
            },
        });

        expect(getStreamingProviderIdForUri("test://track/1")).toBe(providerId);
        expect(getStreamingProviderIdForUri("file:///music/track.mp3")).toBeNull();
    });
});
