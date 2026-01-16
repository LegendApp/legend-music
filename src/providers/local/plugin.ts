import type { ProviderPlugin } from "@/providers/pluginRegistry";
import { localPlaybackProvider } from "@/providers/local/playbackProvider";
import { localSearchProvider } from "@/providers/local/search";
import { localProvider } from "@/providers/localProvider";

export const localPlugin: ProviderPlugin = {
    provider: localProvider,
    searchProvider: localSearchProvider,
    playbackProvider: localPlaybackProvider,
};
