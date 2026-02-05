import { computed, observable } from "@legendapp/state";
import { createJSONManager } from "@/utils/JSONManager";
import type { StreamingProvider, StreamingProviderId, StreamingProviderSession } from "./types";

type StreamingProviderSettings = {
    enabledProviders: Partial<Record<StreamingProviderId, boolean>>;
    preferredProviderId: StreamingProviderId | "auto";
};

const streamingProviderSettings$ = createJSONManager<StreamingProviderSettings>({
    filename: "provider-settings",
    initialValue: {
        enabledProviders: {},
        preferredProviderId: "auto",
    },
});

const registry = observable<Record<StreamingProviderId, StreamingProvider>>({});
const streamingProviderSessions$ = observable<Record<StreamingProviderId, StreamingProviderSession | null>>({});

export const preferredStreamingProviderId$ = computed(() =>
    resolvePreferredStreamingProviderId(streamingProviderSettings$.get()),
);
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

export function getPreferredStreamingProvider(): StreamingProvider | undefined {
    const id = preferredStreamingProviderId$.get();
    return id ? getStreamingProvider(id) : undefined;
}

export function getActiveStreamingProvider(): StreamingProvider | undefined {
    return getPreferredStreamingProvider();
}

export function setStreamingProviderEnabled(providerId: StreamingProviderId, enabled: boolean): void {
    if (providerId === "local") {
        return;
    }

    streamingProviderSettings$.enabledProviders[providerId].set(enabled);

    const preferredProviderId = streamingProviderSettings$.preferredProviderId.peek();
    if (enabled) {
        if (
            preferredProviderId === "auto" ||
            !preferredProviderId ||
            !isStreamingProviderEnabled(preferredProviderId)
        ) {
            streamingProviderSettings$.preferredProviderId.set(providerId);
        }
        return;
    }

    if (preferredProviderId === providerId) {
        const nextPreferred = getEnabledStreamingProviderIds()
            .filter((id) => id !== "local" && id !== providerId)[0] ?? "auto";
        streamingProviderSettings$.preferredProviderId.set(nextPreferred);
    }
}

export function setPreferredStreamingProviderId(providerId: StreamingProviderId | "auto"): void {
    streamingProviderSettings$.preferredProviderId.set(providerId);
}

export function getRegisteredStreamingProviders(): StreamingProvider[] {
    return Object.values(registry.peek()) as StreamingProvider[];
}

export function getStreamingProviderSession(providerId: StreamingProviderId): StreamingProviderSession | null {
    const provider = getStreamingProvider(providerId);
    return provider ? provider.getSession() : null;
}

export function setStreamingProviderSession(
    providerId: StreamingProviderId,
    session: StreamingProviderSession | null,
): void {
    streamingProviderSessions$[providerId].set(session);
}

export function resolveStreamingProviderEnabled(
    providerId: StreamingProviderId,
    settings: StreamingProviderSettings,
): boolean {
    if (providerId === "local") {
        return true;
    }

    const enabledProviders = settings.enabledProviders ?? {};
    const explicit = enabledProviders[providerId];
    const hasExplicitSettings = Object.keys(enabledProviders).length > 0;
    if (typeof explicit === "boolean") {
        return explicit;
    }

    return false;
}

export function isStreamingProviderEnabled(providerId: StreamingProviderId): boolean {
    return resolveStreamingProviderEnabled(providerId, streamingProviderSettings$.get());
}

export function getEnabledStreamingProviderIds(
    settings: StreamingProviderSettings = streamingProviderSettings$.get(),
): StreamingProviderId[] {
    return getRegisteredStreamingProviders()
        .map((provider) => provider.id)
        .filter((providerId) => resolveStreamingProviderEnabled(providerId, settings));
}

export function resolvePreferredStreamingProviderId(
    settings: StreamingProviderSettings,
): StreamingProviderId | null {
    const preferredProviderId = settings.preferredProviderId;
    if (
        preferredProviderId &&
        preferredProviderId !== "auto" &&
        resolveStreamingProviderEnabled(preferredProviderId, settings)
    ) {
        return preferredProviderId;
    }

    const enabledProviders = getEnabledStreamingProviderIds(settings).filter((providerId) => providerId !== "local");
    return enabledProviders[0] ?? null;
}

export function isStreamingProviderValid(
    providerId: StreamingProviderId,
    options: { session?: StreamingProviderSession | null } = {},
): boolean {
    if (providerId === "local") {
        return true;
    }

    if (!isStreamingProviderEnabled(providerId)) {
        return false;
    }

    const session =
        options.session ??
        streamingProviderSessions$[providerId].get() ??
        getStreamingProvider(providerId)?.getSession() ??
        null;
    return Boolean(session?.isAuthenticated);
}
