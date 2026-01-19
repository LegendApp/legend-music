import type { ProviderSearchInput, ProviderSearchProvider, SearchResult } from "@/providers/search/types";

const MAX_RESULTS = 20;

export function buildLocalSearchResults({
    query,
    tracks = [],
    playlists = [],
    albums = [],
}: ProviderSearchInput): SearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) {
        return [];
    }

    const lowerQuery = trimmed.toLowerCase();
    const tokens = lowerQuery.split(/\s+/).filter(Boolean);
    const matchesAllTokens = (value: string): boolean => tokens.every((token) => value.includes(token));
    const results: SearchResult[] = [];

    for (const track of tracks) {
        if (results.length >= MAX_RESULTS) {
            break;
        }
        const title = track.title.toLowerCase();
        const artist = track.artist.toLowerCase();
        const album = track.album?.toLowerCase();
        const haystack = [title, artist, album].filter(Boolean).join(" ");
        if (matchesAllTokens(haystack)) {
            results.push({ type: "track", item: track });
        }
    }

    for (const playlist of playlists) {
        if (results.length >= MAX_RESULTS) {
            break;
        }
        if (matchesAllTokens(playlist.name.toLowerCase())) {
            results.push({ type: "playlist", item: playlist });
        }
    }

    for (const album of albums) {
        if (results.length >= MAX_RESULTS) {
            break;
        }
        if (matchesAllTokens(album.name.toLowerCase())) {
            results.push({ type: "library", item: album });
        }
    }

    return results;
}

export const localSearchProvider: ProviderSearchProvider = {
    id: "local",
    searchMode: "immediate",
    search: (input) => buildLocalSearchResults(input),
};
