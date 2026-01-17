import * as pluginRegistry from "@/providers/pluginRegistry";
import * as setupProviders from "@/providers/setupProviders";
import type { Provider, ProviderCapabilities, ProviderSession } from "@/providers/types";

const createProvider = (id: string): Provider => {
    const capabilities: ProviderCapabilities = {
        supportsSearch: false,
        supportsLibrary: false,
        supportsPlayback: false,
    };
    const session: ProviderSession = { isAuthenticated: false };

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

describe("initializeProviderPlugins", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("fans out library sync across plugins", async () => {
        const syncA = jest.fn().mockResolvedValue(undefined);
        const syncB = jest.fn().mockResolvedValue(undefined);

        jest.spyOn(pluginRegistry, "getProviderPlugins").mockReturnValue([
            {
                provider: createProvider("test-a"),
                library: { sync: syncA },
            },
            {
                provider: createProvider("test-b"),
                library: { sync: syncB },
            },
        ]);

        jest.spyOn(setupProviders, "ensureProvidersRegistered").mockImplementation(() => {});

        await setupProviders.initializeProviderPlugins({ reason: "manual" });

        expect(syncA).toHaveBeenCalledWith({ reason: "manual" });
        expect(syncB).toHaveBeenCalledWith({ reason: "manual" });
    });
});
