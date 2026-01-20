import { computed } from "@legendapp/state";
import type { ProviderSearchInput, ProviderSearchProvider } from "@/providers/search/types";
import { spotifyAuthState$ } from "@/providers/spotify/authState";
import { logSpotifyDebug } from "@/providers/spotify/logging";
import { buildSpotifyLocalTrack } from "@/providers/spotify/trackMapping";
import type { ProviderTrack } from "@/providers/types";
import { ensureSpotifyAccessToken } from "./auth";
import { SPOTIFY_API_BASE } from "./constants";

type SpotifyTrack = {
    id: string;
    name: string;
    uri: string;
    duration_ms: number;
    explicit: boolean;
    artists: { name: string; external_urls?: { spotify?: string } }[];
    album: { name: string; images?: { url: string }[]; external_urls?: { spotify?: string } };
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

    logSpotifyDebug("spotify search response", { query, items });

    return items.map((track) => {
        const artistUrls = (track.artists ?? [])
            .map((artist) => artist.external_urls?.spotify)
            .filter((url): url is string => Boolean(url));

        return {
            provider: "spotify",
            id: track.id,
            uri: track.uri,
            name: track.name,
            durationMs: track.duration_ms,
            artists: track.artists?.map((artist) => artist.name) ?? [],
            artistUrls: artistUrls.length > 0 ? artistUrls : undefined,
            album: track.album?.name,
            albumUrl: track.album?.external_urls?.spotify,
            thumbnail: track.album?.images?.[0]?.url,
            isExplicit: track.explicit,
        };
    });
}

const SPOTIFY_SEARCH_LIMIT = 20;

export const isSpotifySearchEnabled$ = computed(() => {
    const auth = spotifyAuthState$.get();
    const hasValidAccessToken = Boolean(auth.accessToken && auth.expiresAt && auth.expiresAt > Date.now());
    return Boolean(auth.refreshToken || hasValidAccessToken);
});

export const spotifySearchProvider: ProviderSearchProvider = {
    id: "spotify",
    searchMode: "submit",
    isEnabled$: isSpotifySearchEnabled$,
    async search({ query }: ProviderSearchInput) {
        const trimmed = query.trim();
        if (!trimmed) {
            return [];
        }

        const tracks = await searchSpotifyTracks(trimmed, SPOTIFY_SEARCH_LIMIT);
        return tracks.map((track) => ({ type: "track", item: buildSpotifyLocalTrack(track) }));
    },
};
