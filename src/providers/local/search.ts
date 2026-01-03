import type { ProviderSearchInput, ProviderSearchProvider, SearchResult } from "@/providers/search/types";

const MAX_RESULTS = 20;

export function buildLocalSearchResults({
    query,
    tracks = [],
    playlists = [],
    albums = [],
    artists = [],
}: ProviderSearchInput): SearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) {
        return [];
    }

    const lowerQuery = trimmed.toLowerCase();
    const results: SearchResult[] = [];

    for (const track of tracks) {
        if (results.length >= MAX_RESULTS) {
            break;
        }
        const title = track.title.toLowerCase();
        const artist = track.artist.toLowerCase();
        const album = track.album?.toLowerCase();
        if (title.includes(lowerQuery) || artist.includes(lowerQuery) || album?.includes(lowerQuery)) {
            results.push({ type: "track", item: track });
        }
    }

    for (const playlist of playlists) {
        if (results.length >= MAX_RESULTS) {
            break;
        }
        if (playlist.name.toLowerCase().includes(lowerQuery)) {
            results.push({ type: "playlist", item: playlist });
        }
    }

    for (const artist of artists) {
        if (results.length >= MAX_RESULTS) {
            break;
        }
        if (artist.name.toLowerCase().includes(lowerQuery)) {
            results.push({ type: "library", item: artist });
        }
    }

    for (const album of albums) {
        if (results.length >= MAX_RESULTS) {
            break;
        }
        if (album.name.toLowerCase().includes(lowerQuery)) {
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
