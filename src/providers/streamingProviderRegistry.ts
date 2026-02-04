import { computed, observable } from "@legendapp/state";
import { createJSONManager } from "@/utils/JSONManager";
import type { StreamingProvider, StreamingProviderId, StreamingProviderSession } from "./types";

type StreamingProviderSettings = {
    activeProviderId: StreamingProviderId;
    lastProviderId?: StreamingProviderId;
};

const streamingProviderSettings$ = createJSONManager<StreamingProviderSettings>({
    filename: "provider-settings",
    initialValue: {
        activeProviderId: "local",
        lastProviderId: "local",
    },
});

const registry = observable<Record<StreamingProviderId, StreamingProvider>>({});
const streamingProviderSessions$ = observable<Record<StreamingProviderId, StreamingProviderSession | null>>({});

export const activeStreamingProviderId$ = computed(() => streamingProviderSettings$.activeProviderId.get());
export { streamingProviderSettings$, streamingProviderSessions$ };

export function registerStreamingProvider(provider: StreamingProvider): void {
    const current = registry.get();
    registry.set({
        ...current,
        [provider.id]: provider,
    });
    streamingProviderSessions$[provider.id].set(provider.getSession());
}

export function getStreamingProvider(providerId: StreamingProviderId): StreamingProvider | undefined {
    return registry[providerId].get() as unknown as StreamingProvider | undefined;
}

export function getActiveStreamingProvider(): StreamingProvider | undefined {
    const id = activeStreamingProviderId$.get();
    return getStreamingProvider(id);
}

export function setActiveStreamingProvider(providerId: StreamingProviderId): void {
    streamingProviderSettings$.activeProviderId.set(providerId);
    streamingProviderSettings$.lastProviderId.set(providerId);
}

export function getRegisteredStreamingProviders(): StreamingProvider[] {
    return Object.values(registry.peek()) as StreamingProvider[];
}

export function getStreamingProviderSession(providerId: StreamingProviderId): StreamingProviderSession | null {
    const provider = getStreamingProvider(providerId);
    return provider ? provider.getSession() : null;
}

export function setStreamingProviderSession(providerId: StreamingProviderId, session: StreamingProviderSession | null): void {
    streamingProviderSessions$[providerId].set(session);
}

export function isStreamingProviderEnabled(providerId: StreamingProviderId): boolean {
    return activeStreamingProviderId$.get() === providerId;
}

export function isStreamingProviderValid(
    providerId: StreamingProviderId,
    options: { activeProviderId?: StreamingProviderId; session?: StreamingProviderSession | null } = {},
): boolean {
    const activeProviderId = options.activeProviderId ?? activeStreamingProviderId$.get();
    if (activeProviderId !== providerId) {
        return false;
    }

    const session =
        options.session ??
        streamingProviderSessions$[providerId].get() ??
        getStreamingProvider(providerId)?.getSession() ??
        null;
    return Boolean(session?.isAuthenticated);
}
