import type { ProviderPlugin } from "@/providers/pluginRegistry";
import { youtubeMusicProvider } from "@/providers/youtubeMusic/provider";
import { youtubeMusicSearchProvider } from "@/providers/youtubeMusic/search";

export const youtubeMusicPlugin: ProviderPlugin = {
    provider: youtubeMusicProvider,
    searchProvider: youtubeMusicSearchProvider,
};
