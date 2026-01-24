import * as pluginRegistry from "@/providers/pluginRegistry";
import * as setupProviders from "@/providers/setupProviders";
import type { StreamingProvider, StreamingProviderCapabilities, StreamingProviderSession } from "@/providers/types";

const createProvider = (id: string): StreamingProvider => {
    const capabilities: StreamingProviderCapabilities = {
        supportsSearch: false,
        supportsLibrary: false,
        supportsPlayback: false,
    };
    const session: StreamingProviderSession = { isAuthenticated: false };

    return {
        id,
        name: `Provider ${id}`,
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

describe("initializeStreamingProviderPlugins", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("fans out library sync across plugins", async () => {
        const syncA = jest.fn().mockResolvedValue(undefined);
        const syncB = jest.fn().mockResolvedValue(undefined);

        jest.spyOn(pluginRegistry, "getStreamingProviderPlugins").mockReturnValue([
            {
                provider: createProvider("test-a"),
                library: { sync: syncA },
            },
            {
                provider: createProvider("test-b"),
                library: { sync: syncB },
            },
        ]);

        jest.spyOn(setupProviders, "ensureStreamingProvidersRegistered").mockImplementation(() => {});

        await setupProviders.initializeStreamingProviderPlugins({ reason: "manual" });

        expect(syncA).toHaveBeenCalledWith({ reason: "manual" });
        expect(syncB).toHaveBeenCalledWith({ reason: "manual" });
    });
});
