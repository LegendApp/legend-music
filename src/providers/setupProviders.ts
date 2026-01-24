import { localPlugin } from "@/providers/local/plugin";
import {
    getStreamingProviderPlugins,
    registerStreamingProviderPlugin,
    type StreamingProviderPluginInitContext,
} from "@/providers/pluginRegistry";
import { setStreamingProviderSession } from "@/providers/streamingProviderRegistry";
import { localLibrarySearchProvider } from "@/providers/localLibrary/search";
import { registerSearchProvider } from "@/providers/search/registry";
import { appleMusicPlugin } from "@/providers/appleMusic/plugin";
import { spotifyPlugin } from "@/providers/spotify/plugin";
import { youtubeMusicPlugin } from "@/providers/youtubeMusic/plugin";

let initialized = false;

export function ensureStreamingProvidersRegistered(): void {
    if (initialized) {
        return;
    }
    registerStreamingProviderPlugin(localPlugin);
    registerStreamingProviderPlugin(appleMusicPlugin);
    registerStreamingProviderPlugin(spotifyPlugin);
    registerStreamingProviderPlugin(youtubeMusicPlugin);
    registerSearchProvider(localLibrarySearchProvider);
    initialized = true;
}

export async function initializeStreamingProviderPlugins(
    context: StreamingProviderPluginInitContext = { reason: "app-start" },
): Promise<void> {
    ensureStreamingProvidersRegistered();
    const plugins = getStreamingProviderPlugins();

    for (const plugin of plugins) {
        const providerOptions = {
            ...context.providerOptions,
            onStateChange: (session) => {
                setStreamingProviderSession(plugin.provider.id, session);
                context.providerOptions?.onStateChange?.(session);
            },
        };

        try {
            await plugin.provider.initialize(providerOptions);
            setStreamingProviderSession(plugin.provider.id, plugin.provider.getSession());
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
