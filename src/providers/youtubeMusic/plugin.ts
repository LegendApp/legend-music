import type { ProviderPlugin } from "@/providers/pluginRegistry";
import { youtubeMusicProvider } from "@/providers/youtubeMusic/provider";
import { youtubeMusicSearchProvider } from "@/providers/youtubeMusic/search";
import { youtubeMusicPlaybackProvider } from "@/providers/youtubeMusic/playbackProvider";

export const youtubeMusicPlugin: ProviderPlugin = {
    provider: youtubeMusicProvider,
    search: youtubeMusicSearchProvider,
    playback: youtubeMusicPlaybackProvider,
};
