import type { ProviderPlugin } from "@/providers/pluginRegistry";
import { localPlaybackProvider } from "@/providers/local/playbackProvider";
import { localSearchProvider } from "@/providers/local/search";
import { localProvider } from "@/providers/localProvider";
import { initializeLocalMusic } from "@/systems/LocalMusicState";

export const localPlugin: ProviderPlugin = {
    provider: localProvider,
    initialize: () => {
        initializeLocalMusic();
    },
    search: localSearchProvider,
    playback: localPlaybackProvider,
};
