import type { StreamingProviderTrack } from "@/providers/types";
import { ensureSpotifyAccessToken } from "@/providers/spotify/auth";
import { SPOTIFY_API_BASE } from "@/providers/spotify/constants";
import { isSpotifySearchEnabled$, searchSpotifyTracks } from "@/providers/spotify/search";
import { buildSpotifyLocalTrack } from "@/providers/spotify/trackMapping";
import type { LocalTrack } from "@/systems/LocalMusicState";
import type { SuggestionProvider, SuggestionRequest, SuggestionResult } from "@/systems/suggestions/types";

const SPOTIFY_TRACK_PREFIX = "spotify:track:";
const MAX_SEED_TRACKS = 5;
const DEFAULT_TRACK_COUNT = 10;

type SpotifyTrack = {
    id: string;
    name: string;
    uri: string;
    duration_ms: number;
    explicit: boolean;
    artists: { name: string; external_urls?: { spotify?: string } }[];
    album: { name: string; images?: { url: string }[]; external_urls?: { spotify?: string } };
};

type SpotifyRecommendationsResponse = {
    tracks?: SpotifyTrack[];
};

const mapSpotifyTrack = (track: SpotifyTrack): StreamingProviderTrack => {
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

const extractSpotifyTrackId = (value?: string | null): string | null => {
    if (!value) {
        return null;
    }
    if (value.startsWith(SPOTIFY_TRACK_PREFIX)) {
        return value.slice(SPOTIFY_TRACK_PREFIX.length);
    }
    return null;
};

const buildSeedQuery = (track: LocalTrack): string => {
    const parts = [track.title, track.artist].filter(Boolean);
    return parts.join(" ");
};

const resolveSeedTrackIds = async (seedTracks: LocalTrack[]): Promise<string[]> => {
    const ids: string[] = [];

    for (const track of seedTracks) {
        if (ids.length >= MAX_SEED_TRACKS) {
            break;
        }

        const directId = extractSpotifyTrackId(track.uri ?? track.id);
        if (directId) {
            ids.push(directId);
            continue;
        }

        const query = buildSeedQuery(track);
        if (!query) {
            continue;
        }

        try {
            const results = await searchSpotifyTracks(query, 1);
            const match = results[0];
            if (match?.id) {
                ids.push(match.id);
            }
        } catch (error) {
            console.warn("Failed to resolve Spotify seed track", error);
        }
    }

    return ids;
};

const fetchSpotifyRecommendations = async (
    seedTrackIds: string[],
    limit: number,
): Promise<StreamingProviderTrack[]> => {
    if (seedTrackIds.length === 0) {
        return [];
    }

    const token = await ensureSpotifyAccessToken();
    if (!token) {
        throw new Error("Spotify login required before fetching recommendations");
    }

    const recommendationsUrl =
        `${SPOTIFY_API_BASE}/recommendations?limit=${encodeURIComponent(String(limit))}&seed_tracks=` +
        encodeURIComponent(seedTrackIds.join(","));
    const response = await fetch(recommendationsUrl, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Spotify recommendations failed: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as SpotifyRecommendationsResponse;
    const tracks = payload.tracks ?? [];
    return tracks.map(mapSpotifyTrack);
};

const dedupeTracks = (tracks: LocalTrack[]): LocalTrack[] => {
    const seen = new Set<string>();
    const results: LocalTrack[] = [];

    for (const track of tracks) {
        const key = track.id || track.uri || track.filePath;
        if (!key || seen.has(key)) {
            continue;
        }
        seen.add(key);
        results.push(track);
    }

    return results;
};

const suggestQueueExtension = async (seedTracks: LocalTrack[], count: number): Promise<LocalTrack[]> => {
    const seedIds = await resolveSeedTrackIds(seedTracks);
    let recommendations: StreamingProviderTrack[] = [];

    if (seedIds.length > 0) {
        recommendations = await fetchSpotifyRecommendations(seedIds, count);
    }

    if (recommendations.length === 0 && seedTracks.length > 0) {
        const fallbackQuery = buildSeedQuery(seedTracks[seedTracks.length - 1]);
        if (fallbackQuery) {
            recommendations = await searchSpotifyTracks(fallbackQuery, count);
        }
    }

    return dedupeTracks(recommendations.map((track, index) => buildSpotifyLocalTrack(track, { index })));
};

const suggestPlaylist = async (prompt: string, count: number): Promise<LocalTrack[]> => {
    const searchResults = await searchSpotifyTracks(prompt, Math.min(count, 5));
    const seedId = searchResults[0]?.id ?? null;

    let recommendations: StreamingProviderTrack[] = [];
    if (seedId) {
        recommendations = await fetchSpotifyRecommendations([seedId], count);
    }

    if (recommendations.length === 0) {
        recommendations = searchResults.length > 0 ? searchResults : await searchSpotifyTracks(prompt, count);
    }

    return dedupeTracks(recommendations.map((track, index) => buildSpotifyLocalTrack(track, { index })));
};

export const spotifySuggestionProvider: SuggestionProvider = {
    id: "spotify",
    name: "Spotify",
    kind: "spotify",
    isAvailable: () => isSpotifySearchEnabled$.get(),
    supportsModes: ["queue-extension", "playlist"],
    async suggest(request: SuggestionRequest): Promise<SuggestionResult> {
        const count = request.count ?? DEFAULT_TRACK_COUNT;

        if (request.mode === "queue-extension") {
            const seedTracks = request.seedTracks ?? [];
            const tracks = await suggestQueueExtension(seedTracks, count);
            return { providerId: "spotify", tracks };
        }

        const prompt = request.prompt?.trim();
        if (!prompt) {
            throw new Error("Missing playlist prompt.");
        }

        const tracks = await suggestPlaylist(prompt, count);
        return { providerId: "spotify", tracks };
    },
};
