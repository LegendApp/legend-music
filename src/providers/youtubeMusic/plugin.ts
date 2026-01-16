import type { ProviderPlugin } from "@/providers/pluginRegistry";
import { youtubeMusicProvider } from "@/providers/youtubeMusic/provider";

export const youtubeMusicPlugin: ProviderPlugin = {
    provider: youtubeMusicProvider,
};
