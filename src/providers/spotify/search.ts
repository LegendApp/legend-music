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

type SpotifySearchResponse = {
    tracks?: { items?: SpotifyTrack[] };
};

const SPOTIFY_SEARCH_PAGE_SIZE = 50;
const SPOTIFY_SEARCH_MAX_RESULTS = 200;

const mapSpotifyTrack = (track: SpotifyTrack): ProviderTrack => {
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
};

const escapeSpotifyQuery = (value: string): string => value.replace(/"/g, '\\"');

const fetchSpotifyTracksPage = async (
    query: string,
    token: string,
    limit: number,
    offset: number,
): Promise<SpotifyTrack[]> => {
    const response = await fetch(
        `${SPOTIFY_API_BASE}/search?type=track&limit=${encodeURIComponent(
            String(limit),
        )}&offset=${encodeURIComponent(String(offset))}&q=${encodeURIComponent(query)}`,
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

    const json = (await response.json()) as SpotifySearchResponse;
    return json.tracks?.items ?? [];
};

const searchSpotifyTracksPaged = async (
    query: string,
    options?: { limit?: number; maxResults?: number },
): Promise<ProviderTrack[]> => {
    if (!query.trim()) {
        return [];
    }

    const token = await ensureSpotifyAccessToken();
    if (!token) {
        throw new Error("Spotify login required before searching");
    }

    const pageSize = Math.min(options?.limit ?? SPOTIFY_SEARCH_PAGE_SIZE, SPOTIFY_SEARCH_PAGE_SIZE);
    const maxResults = options?.maxResults ?? SPOTIFY_SEARCH_MAX_RESULTS;
    const tracks: ProviderTrack[] = [];

    for (let offset = 0; offset < maxResults; offset += pageSize) {
        const items = await fetchSpotifyTracksPage(query, token, pageSize, offset);
        if (items.length === 0) {
            break;
        }
        tracks.push(...items.map(mapSpotifyTrack));
        if (items.length < pageSize) {
            break;
        }
    }

    return tracks.slice(0, maxResults);
};

export async function searchSpotifyTracks(query: string, limit = 10): Promise<ProviderTrack[]> {
    if (!query.trim()) {
        return [];
    }

    const token = await ensureSpotifyAccessToken();
    if (!token) {
        throw new Error("Spotify login required before searching");
    }

    const items = await fetchSpotifyTracksPage(query, token, limit, 0);

    logSpotifyDebug("spotify search response", { query, items });

    return items.map(mapSpotifyTrack);
}

export async function fetchSpotifyArtistTracks(
    artist: string,
    options?: { maxResults?: number },
): Promise<ProviderTrack[]> {
    const query = `artist:"${escapeSpotifyQuery(artist)}"`;
    return searchSpotifyTracksPaged(query, { maxResults: options?.maxResults });
}

export async function fetchSpotifyAlbumTracks(
    album: string,
    options?: { artist?: string | null; maxResults?: number },
): Promise<ProviderTrack[]> {
    const escapedAlbum = escapeSpotifyQuery(album);
    const artist = options?.artist?.trim();
    const query = artist
        ? `album:"${escapedAlbum}" artist:"${escapeSpotifyQuery(artist)}"`
        : `album:"${escapedAlbum}"`;
    return searchSpotifyTracksPaged(query, { maxResults: options?.maxResults });
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
