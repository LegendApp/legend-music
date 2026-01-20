import type { ProviderSearchProvider } from "@/providers/search/types";
import { enabledSearchProviderIds$, getSearchProviders } from "@/providers/search/registry";
import type { ProviderId } from "@/providers/types";
import { normalizeArtistName } from "@/systems/LibraryState";
import { logAiDebug, warnAiDebug } from "@/systems/ai/logging";
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

const sanitizeSearchToken = (value?: string): string => (value ?? "").replace(/"/g, "").trim();

const formatSpotifyField = (field: string, value?: string): string | null => {
    const sanitized = sanitizeSearchToken(value);
    if (!sanitized) {
        return null;
    }

    return `${field}:"${sanitized}"`;
};

const formatSearchPhrase = (value?: string): string | null => {
    const sanitized = sanitizeSearchToken(value);
    if (!sanitized) {
        return null;
    }

    return sanitized.includes(" ") ? `"${sanitized}"` : sanitized;
};

const buildProviderSearchQuery = (suggestion: AISuggestedTrack, providerId: ProviderId): string => {
    if (providerId === "spotify") {
        const parts = [
            formatSpotifyField("track", suggestion.title),
            formatSpotifyField("artist", suggestion.artist),
            formatSpotifyField("album", suggestion.album),
        ].filter((value): value is string => Boolean(value));
        return parts.join(" ").trim();
    }

    if (providerId === "appleMusic") {
        const parts = [suggestion.title, suggestion.artist, suggestion.album]
            .map((value) => formatSearchPhrase(value))
            .filter((value): value is string => Boolean(value));
        return parts.join(" ").trim();
    }

    return buildSearchQuery(suggestion);
};

type NormalizedValue = {
    raw: string;
    token: string;
    compact: string;
};

type FieldScore = {
    matched: boolean;
    exact: boolean;
    score: number;
};

type CandidateScore = {
    track: LocalTrack;
    score: number;
    fieldScores: {
        title: FieldScore;
        artist: FieldScore;
        album: FieldScore;
    };
};

type NormalizedSuggestion = {
    title: NormalizedValue;
    artist: NormalizedValue;
    album: NormalizedValue;
};

const normalizeForMatch = (value?: string, normalizer?: (value: string) => string): NormalizedValue => {
    const raw = (value ?? "").trim();
    const normalized = raw ? (normalizer ? normalizer(raw) : raw) : "";
    const token = normalizeToken(normalized);
    return {
        raw: normalized,
        token,
        compact: token.replace(/ /g, ""),
    };
};

const isExactMatch = (a: NormalizedValue, b: NormalizedValue): boolean => {
    if (!a.token || !b.token) {
        return false;
    }

    return a.token === b.token || (a.compact && b.compact && a.compact === b.compact);
};

const hasTokenMatch = (a: NormalizedValue, b: NormalizedValue): boolean => {
    if (!a.token || !b.token) {
        return false;
    }

    if (a.token.includes(b.token) || b.token.includes(a.token)) {
        return true;
    }

    if (a.compact && b.compact && (a.compact.includes(b.compact) || b.compact.includes(a.compact))) {
        return true;
    }

    return false;
};

const scoreField = (
    expected: NormalizedValue,
    actual: NormalizedValue,
    exactScore: number,
    partialScore: number,
): FieldScore => {
    if (!expected.token || !actual.token) {
        return { matched: false, exact: false, score: 0 };
    }

    if (isExactMatch(expected, actual)) {
        return { matched: true, exact: true, score: exactScore };
    }

    if (hasTokenMatch(expected, actual)) {
        return { matched: true, exact: false, score: partialScore };
    }

    return { matched: false, exact: false, score: 0 };
};

const normalizeSuggestion = (suggestion: AISuggestedTrack): NormalizedSuggestion => ({
    title: normalizeForMatch(suggestion.title),
    artist: normalizeForMatch(suggestion.artist, normalizeArtistName),
    album: normalizeForMatch(suggestion.album),
});

const scoreCandidate = (suggestion: NormalizedSuggestion, track: LocalTrack): CandidateScore | null => {
    const titleScore = scoreField(suggestion.title, normalizeForMatch(track.title), 6, 4);
    if (!titleScore.matched) {
        return null;
    }

    const artistScore = scoreField(suggestion.artist, normalizeForMatch(track.artist, normalizeArtistName), 4, 2);
    const albumScore = scoreField(suggestion.album, normalizeForMatch(track.album), 2, 1);

    let score = titleScore.score + artistScore.score + albumScore.score;
    if (suggestion.artist.token && !artistScore.matched) {
        score -= 3;
    }
    if (suggestion.album.token && !albumScore.matched) {
        score -= 1;
    }

    return {
        track,
        score,
        fieldScores: {
            title: titleScore,
            artist: artistScore,
            album: albumScore,
        },
    };
};

const pickBestCandidate = (candidates: CandidateScore[]): CandidateScore | null => {
    let best: CandidateScore | null = null;
    for (const candidate of candidates) {
        if (!best || candidate.score > best.score) {
            best = candidate;
        }
    }
    return best;
};

const selectBestCandidate = (suggestion: NormalizedSuggestion, candidates: CandidateScore[]): CandidateScore | null => {
    if (candidates.length === 0) {
        return null;
    }

    if (suggestion.artist.token) {
        const withArtistMatch = candidates.filter((candidate) => candidate.fieldScores.artist.matched);
        if (withArtistMatch.length === 0) {
            return null;
        }

        return pickBestCandidate(withArtistMatch);
    }

    return pickBestCandidate(candidates);
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
    const normalizedSuggestion = normalizeSuggestion(suggestion);

    for (const provider of providers) {
        if (provider.isEnabled$ && !provider.isEnabled$.get()) {
            continue;
        }

        const query = buildProviderSearchQuery(suggestion, provider.id);
        if (!query) {
            continue;
        }

        try {
            logAiDebug("[AI resolve] searching provider", { providerId: provider.id, query, suggestion });
            const results = await provider.search({ query });
            const trackResults = results
                .filter((result): result is { type: "track"; item: LocalTrack } => result.type === "track")
                .map((result) => scoreCandidate(normalizedSuggestion, result.item))
                .filter((candidate): candidate is CandidateScore => Boolean(candidate));

            if (trackResults.length === 0) {
                logAiDebug("[AI resolve] no scored candidates", {
                    providerId: provider.id,
                    query,
                    suggestion,
                    resultCount: results.length,
                });
                continue;
            }

            const rankedCandidates = [...trackResults].sort((a, b) => b.score - a.score);
            logAiDebug("[AI resolve] ranked candidates", {
                providerId: provider.id,
                query,
                suggestion,
                candidates: rankedCandidates.slice(0, 5).map((candidate) => ({
                    id: candidate.track.id,
                    title: candidate.track.title,
                    artist: candidate.track.artist,
                    album: candidate.track.album,
                    score: candidate.score,
                    matches: candidate.fieldScores,
                })),
            });

            const bestCandidate = selectBestCandidate(normalizedSuggestion, trackResults);
            if (bestCandidate) {
                logAiDebug("[AI resolve] selected candidate", {
                    providerId: provider.id,
                    query,
                    suggestion,
                    selected: {
                        id: bestCandidate.track.id,
                        title: bestCandidate.track.title,
                        artist: bestCandidate.track.artist,
                        album: bestCandidate.track.album,
                        score: bestCandidate.score,
                        matches: bestCandidate.fieldScores,
                    },
                });
                return bestCandidate.track;
            }

            if (normalizedSuggestion.artist.token) {
                warnAiDebug("[AI resolve] no artist match in results", {
                    providerId: provider.id,
                    query,
                    suggestion,
                });
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

    logAiDebug("[AI resolve] summary", {
        preferredProviders: options.preferredProviders ?? [],
        suggestions,
        resolvedCount: resolved.length,
        unresolvedCount: unresolved.length,
    });

    return { tracks: resolved, unresolved };
};
