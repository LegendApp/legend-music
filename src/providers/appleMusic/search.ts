import { computed } from "@legendapp/state";
import type { StreamingProviderSearchInput, StreamingProviderSearchProvider } from "@/providers/search/types";
import type { StreamingProviderTrack } from "@/providers/types";
import { ensureAppleMusicDeveloperToken } from "@/providers/appleMusic/auth";
import { appleMusicAuthState$, isAppleMusicAuthorized$ } from "@/providers/appleMusic/authState";
import { APPLE_MUSIC_API_BASE } from "@/providers/appleMusic/constants";
import { buildAppleMusicLocalTrack } from "@/providers/appleMusic/trackMapping";

type AppleMusicArtwork = {
    url?: string;
};

type AppleMusicSongAttributes = {
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    artwork?: AppleMusicArtwork;
    contentRating?: string;
    isExplicit?: boolean;
};

type AppleMusicSong = {
    id: string;
    type?: string;
    attributes?: AppleMusicSongAttributes;
};

type AppleMusicSearchResponse = {
    results?: {
        songs?: {
            data?: AppleMusicSong[];
        };
    };
};

const SEARCH_LIMIT = 20;
const DETAIL_SEARCH_LIMIT = 50;

const resolveArtworkUrl = (artwork?: AppleMusicArtwork): string | undefined => {
    if (!artwork?.url) {
        return undefined;
    }

    return artwork.url
        .replace("{w}", "300")
        .replace("{h}", "300")
        .replace("{f}", "jpg");
};

const toAppleMusicTrackUri = (trackId: string): string => `apple-music:track:${trackId}`;

export async function searchAppleMusicTracks(query: string, limit = 10): Promise<StreamingProviderTrack[]> {
    if (!query.trim()) {
        return [];
    }

    const developerToken = await ensureAppleMusicDeveloperToken();
    if (!developerToken) {
        throw new Error("Apple Music developer token required before searching");
    }

    const storefront = appleMusicAuthState$.storefront.peek() ?? "us";
    const response = await fetch(
        `${APPLE_MUSIC_API_BASE}/catalog/${encodeURIComponent(
            storefront,
        )}/search?types=songs&limit=${encodeURIComponent(String(limit))}&term=${encodeURIComponent(query)}`,
        {
            headers: {
                Authorization: `Bearer ${developerToken}`,
            },
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Apple Music search failed: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as AppleMusicSearchResponse;
    const items = payload.results?.songs?.data ?? [];

    return items.map((song) => {
        const isExplicit =
            song.attributes?.isExplicit === true ||
            song.attributes?.contentRating?.toLowerCase() === "explicit";
        return {
            provider: "appleMusic",
            id: song.id,
            uri: toAppleMusicTrackUri(song.id),
            name: song.attributes?.name ?? "Unknown Track",
            durationMs: song.attributes?.durationInMillis,
            artists: song.attributes?.artistName ? [song.attributes.artistName] : [],
            album: song.attributes?.albumName,
            thumbnail: resolveArtworkUrl(song.attributes?.artwork),
            isExplicit,
        };
    });
}

export async function fetchAppleMusicArtistTracks(
    artist: string,
    options?: { limit?: number },
): Promise<StreamingProviderTrack[]> {
    const query = artist.trim();
    if (!query) {
        return [];
    }

    return searchAppleMusicTracks(query, options?.limit ?? DETAIL_SEARCH_LIMIT);
}

export async function fetchAppleMusicAlbumTracks(
    album: string,
    options?: { artist?: string | null; limit?: number },
): Promise<StreamingProviderTrack[]> {
    const trimmedAlbum = album.trim();
    if (!trimmedAlbum) {
        return [];
    }

    const artist = options?.artist?.trim();
    const query = artist ? `${trimmedAlbum} ${artist}` : trimmedAlbum;
    return searchAppleMusicTracks(query, options?.limit ?? DETAIL_SEARCH_LIMIT);
}

export const isAppleMusicSearchEnabled$ = computed(() => isAppleMusicAuthorized$.get());

export const appleMusicSearchProvider: StreamingProviderSearchProvider = {
    id: "appleMusic",
    searchMode: "submit",
    isEnabled$: isAppleMusicSearchEnabled$,
    async search({ query }: StreamingProviderSearchInput) {
        const trimmed = query.trim();
        if (!trimmed) {
            return [];
        }

        const tracks = await searchAppleMusicTracks(trimmed, SEARCH_LIMIT);
        return tracks.map((track) => ({ type: "track", item: buildAppleMusicLocalTrack(track) }));
    },
};
