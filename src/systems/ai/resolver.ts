import type { ProviderSearchProvider } from "@/providers/search/types";
import { enabledSearchProviderIds$, getSearchProviders } from "@/providers/search/registry";
import type { ProviderId } from "@/providers/types";
import { normalizeArtistName } from "@/systems/LibraryState";
import { localMusicState$, type LocalTrack } from "@/systems/LocalMusicState";
import type { AISuggestedTrack, AIResolveResult } from "@/systems/ai/types";

const normalizeToken = (value: string): string =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ");

const buildLocalIndexes = (tracks: LocalTrack[]) => {
    const byTitleArtist = new Map<string, LocalTrack[]>();
    const byTitle = new Map<string, LocalTrack[]>();

    for (const track of tracks) {
        const titleKey = normalizeToken(track.title);
        const artistKey = normalizeToken(normalizeArtistName(track.artist));

        if (titleKey) {
            const titleMatches = byTitle.get(titleKey) ?? [];
            titleMatches.push(track);
            byTitle.set(titleKey, titleMatches);
        }

        if (titleKey && artistKey) {
            const compositeKey = `${titleKey}::${artistKey}`;
            const matches = byTitleArtist.get(compositeKey) ?? [];
            matches.push(track);
            byTitleArtist.set(compositeKey, matches);
        }
    }

    return { byTitleArtist, byTitle };
};

const resolveLocalMatch = (
    suggestion: AISuggestedTrack,
    indexes: ReturnType<typeof buildLocalIndexes>,
): LocalTrack | null => {
    const titleKey = normalizeToken(suggestion.title);
    const artistKey = normalizeToken(suggestion.artist ? normalizeArtistName(suggestion.artist) : "");

    if (titleKey && artistKey) {
        const matches = indexes.byTitleArtist.get(`${titleKey}::${artistKey}`);
        if (matches && matches.length > 0) {
            return matches[0];
        }
    }

    if (titleKey) {
        const matches = indexes.byTitle.get(titleKey);
        if (matches && matches.length > 0) {
            return matches[0];
        }
    }

    return null;
};

const buildSearchQuery = (suggestion: AISuggestedTrack): string => {
    const parts = [suggestion.title, suggestion.artist, suggestion.album].filter(
        (value): value is string => Boolean(value && value.trim().length > 0),
    );
    return parts.join(" ").trim();
};

const sortProviders = (providers: ProviderSearchProvider[], preferred: ProviderId[] = []) => {
    const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
    const ordered: ProviderSearchProvider[] = [];

    for (const id of preferred) {
        const provider = providerMap.get(id);
        if (provider) {
            ordered.push(provider);
            providerMap.delete(id);
        }
    }

    for (const provider of providerMap.values()) {
        ordered.push(provider);
    }

    return ordered;
};

const resolveViaProviders = async (
    suggestion: AISuggestedTrack,
    providers: ProviderSearchProvider[],
): Promise<LocalTrack | null> => {
    const query = buildSearchQuery(suggestion);
    if (!query) {
        return null;
    }

    for (const provider of providers) {
        if (provider.isEnabled$ && !provider.isEnabled$.get()) {
            continue;
        }

        try {
            const results = await provider.search({ query });
            const firstTrack = results.find((result) => result.type === "track");
            if (firstTrack?.type === "track") {
                return firstTrack.item;
            }
        } catch (error) {
            console.warn(`AI search failed for provider ${provider.id}`, error);
        }
    }

    return null;
};

export const resolveSuggestedTracks = async (
    suggestions: AISuggestedTrack[],
    options: { preferredProviders?: ProviderId[] } = {},
): Promise<AIResolveResult> => {
    const localTracks = localMusicState$.tracks.peek();
    const indexes = buildLocalIndexes(localTracks);
    const enabledProviderIds = new Set(enabledSearchProviderIds$.get());
    const preferredProviders = (options.preferredProviders ?? []).filter((providerId) =>
        enabledProviderIds.has(providerId),
    );
    const providers = sortProviders(
        getSearchProviders().filter((provider) => enabledProviderIds.has(provider.id)),
        preferredProviders,
    );

    const resolved: LocalTrack[] = [];
    const unresolved: AISuggestedTrack[] = [];

    for (const suggestion of suggestions) {
        const localMatch = resolveLocalMatch(suggestion, indexes);
        if (localMatch) {
            resolved.push(localMatch);
            continue;
        }

        const remoteMatch = await resolveViaProviders(suggestion, providers);
        if (remoteMatch) {
            resolved.push(remoteMatch);
            continue;
        }

        unresolved.push(suggestion);
    }

    console.log("AI resolve results", {
        preferredProviders: options.preferredProviders ?? [],
        suggestions,
        resolved,
        unresolved,
    });

    return { tracks: resolved, unresolved };
};
