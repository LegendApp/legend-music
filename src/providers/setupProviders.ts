import { localPlugin } from "@/providers/local/plugin";
import { getProviderPlugins, registerProviderPlugin, type ProviderPluginInitContext } from "@/providers/pluginRegistry";
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

export async function initializeProviderPlugins(
    context: ProviderPluginInitContext = { reason: "app-start" },
): Promise<void> {
    ensureProvidersRegistered();
    const plugins = getProviderPlugins();

    for (const plugin of plugins) {
        try {
            await plugin.provider.initialize(context.providerOptions);
        } catch (error) {
            console.error(`Failed to initialize provider ${plugin.provider.id}`, error);
        }

        if (!plugin.initialize) {
            continue;
        }

        try {
            await plugin.initialize(context);
        } catch (error) {
            console.error(`Failed to initialize provider plugin ${plugin.provider.id}`, error);
        }
    }
}
