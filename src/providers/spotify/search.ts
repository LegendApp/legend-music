import type { ProviderSearchInput, ProviderSearchProvider } from "@/providers/search/types";
import type { ProviderTrack } from "@/providers/types";
import { buildSpotifyLocalTrack } from "@/providers/spotify/trackMapping";
import { SPOTIFY_API_BASE } from "./constants";
import { ensureSpotifyAccessToken } from "./auth";

type SpotifyTrack = {
    id: string;
    name: string;
    uri: string;
    duration_ms: number;
    explicit: boolean;
    artists: { name: string }[];
    album: { name: string; images?: { url: string }[] };
};

export async function searchSpotifyTracks(query: string, limit = 10): Promise<ProviderTrack[]> {
    if (!query.trim()) {
        return [];
    }

    const token = await ensureSpotifyAccessToken();
    if (!token) {
        throw new Error("Spotify login required before searching");
    }

    const response = await fetch(
        `${SPOTIFY_API_BASE}/search?type=track&limit=${encodeURIComponent(String(limit))}&q=${encodeURIComponent(query)}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Spotify search failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as { tracks?: { items?: SpotifyTrack[] } };
    const items = json.tracks?.items ?? [];

    return items.map((track) => ({
        provider: "spotify",
        id: track.id,
        uri: track.uri,
        name: track.name,
        durationMs: track.duration_ms,
        artists: track.artists?.map((artist) => artist.name) ?? [],
        album: track.album?.name,
        thumbnail: track.album?.images?.[0]?.url,
        isExplicit: track.explicit,
    }));
}

const SPOTIFY_SEARCH_LIMIT = 20;

export const spotifySearchProvider: ProviderSearchProvider = {
    id: "spotify",
    searchMode: "submit",
    async search({ query }: ProviderSearchInput) {
        const trimmed = query.trim();
        if (!trimmed) {
            return [];
        }

        const tracks = await searchSpotifyTracks(trimmed, SPOTIFY_SEARCH_LIMIT);
        return tracks.map((track) => ({ type: "track", item: buildSpotifyLocalTrack(track) }));
    },
};
