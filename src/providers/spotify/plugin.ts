import type { ProviderPlugin } from "@/providers/pluginRegistry";
import { spotifyPlaybackProvider } from "@/providers/spotify/playbackProvider";
import { spotifyProvider } from "@/providers/spotify/provider";
import { spotifySearchProvider } from "@/providers/spotify/search";

export const spotifyPlugin: ProviderPlugin = {
    provider: spotifyProvider,
    search: spotifySearchProvider,
    playback: spotifyPlaybackProvider,
};
