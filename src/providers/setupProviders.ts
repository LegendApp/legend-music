import { localPlugin } from "@/providers/local/plugin";
import { getProviderPlugins, registerProviderPlugin, type ProviderPluginInitContext } from "@/providers/pluginRegistry";
import { setProviderSession } from "@/providers/providerRegistry";
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
        const providerOptions = {
            ...context.providerOptions,
            onStateChange: (session) => {
                setProviderSession(plugin.provider.id, session);
                context.providerOptions?.onStateChange?.(session);
            },
        };

        try {
            await plugin.provider.initialize(providerOptions);
            setProviderSession(plugin.provider.id, plugin.provider.getSession());
        } catch (error) {
            console.error(`Failed to initialize provider ${plugin.provider.id}`, error);
        }

        if (plugin.initialize) {
            try {
                await plugin.initialize(context);
            } catch (error) {
                console.error(`Failed to initialize provider plugin ${plugin.provider.id}`, error);
            }
        }

        if (plugin.library?.sync) {
            try {
                await plugin.library.sync({ reason: context.reason });
            } catch (error) {
                console.error(`Failed to sync provider library ${plugin.provider.id}`, error);
            }
        }
    }
}
