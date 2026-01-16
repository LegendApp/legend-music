import { localPlugin } from "@/providers/local/plugin";
import { registerProviderPlugin } from "@/providers/pluginRegistry";
import { spotifyPlugin } from "@/providers/spotify/plugin";
import { youtubeMusicPlugin } from "@/providers/youtubeMusic/plugin";

let initialized = false;

export function ensureProvidersRegistered(): void {
    if (initialized) {
        return;
    }
    registerProviderPlugin(localPlugin);
    registerProviderPlugin(spotifyPlugin);
    registerProviderPlugin(youtubeMusicPlugin);
    initialized = true;
}
