import { computed } from "@legendapp/state";
import type { StreamingProviderSearchInput, StreamingProviderSearchProvider } from "@/providers/search/types";
import type { StreamingProviderTrack } from "@/providers/types";
import { buildYoutubeMusicLocalTrack, buildYoutubeMusicUri } from "@/providers/youtubeMusic/trackMapping";
import type { YoutubeSearchItem, YoutubeSearchResponse, YoutubeVideoResponse } from "@/providers/youtubeMusic/types";
import { ensureYoutubeMusicAccessToken } from "@/providers/youtubeMusic/auth";
import { youtubeAuthState$ } from "@/providers/youtubeMusic/authState";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const DEFAULT_SEARCH_LIMIT = 20;

export const isYoutubeMusicSearchEnabled$ = computed(() => {
    const auth = youtubeAuthState$.get();
    const hasValidAccessToken = Boolean(auth.accessToken && auth.expiresAt && auth.expiresAt > Date.now());
    return Boolean(auth.refreshToken || hasValidAccessToken);
});

const pickThumbnail = (item: YoutubeSearchItem): string | undefined => {
    const thumbnails = item.snippet?.thumbnails;
    return (
        thumbnails?.maxres?.url ??
        thumbnails?.high?.url ??
        thumbnails?.medium?.url ??
        thumbnails?.default?.url ??
        undefined
    );
};

const parseIsoDurationToSeconds = (value?: string): number | null => {
    if (!value) {
        return null;
    }

    const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) {
        return null;
    }

    const hours = Number.parseInt(match[1] ?? "0", 10);
    const minutes = Number.parseInt(match[2] ?? "0", 10);
    const seconds = Number.parseInt(match[3] ?? "0", 10);

    if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) {
        return null;
    }

    return hours * 3600 + minutes * 60 + seconds;
};

export async function searchYoutubeMusicTracks(
    query: string,
    limit = DEFAULT_SEARCH_LIMIT,
): Promise<StreamingProviderTrack[]> {
    const trimmed = query.trim();
    if (!trimmed) {
        return [];
    }

    const accessToken = await ensureYoutubeMusicAccessToken();
    if (!accessToken) {
        throw new Error("YouTube Music login required. Connect your account in Settings -> YouTube Music.");
    }
    const headers = { Authorization: `Bearer ${accessToken}` };
    const searchUrl =
        `${YOUTUBE_API_BASE}/search?part=snippet&type=video&videoCategoryId=10&maxResults=` +
        `${encodeURIComponent(String(limit))}&q=${encodeURIComponent(trimmed)}`;

    const response = await fetch(searchUrl, { headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`YouTube search failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as YoutubeSearchResponse;
    const items = json.items ?? [];
    const ids = items.map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));

    const durations = new Map<string, number>();
    if (ids.length > 0) {
        const detailsUrl = `${YOUTUBE_API_BASE}/videos?part=contentDetails&id=${encodeURIComponent(ids.join(","))}`;
        const detailsResponse = await fetch(detailsUrl, { headers });
        if (detailsResponse.ok) {
            const detailsJson = (await detailsResponse.json()) as YoutubeVideoResponse;
            for (const item of detailsJson.items ?? []) {
                const durationSeconds = parseIsoDurationToSeconds(item.contentDetails?.duration);
                if (item.id && typeof durationSeconds === "number") {
                    durations.set(item.id, durationSeconds);
                }
            }
        }
    }

    return items
        .map((item) => {
            const id = item.id?.videoId;
            if (!id) {
                return null;
            }
            const title = item.snippet?.title ?? "Unknown Track";
            const channel = item.snippet?.channelTitle ?? "YouTube Music";
            const channelId = item.snippet?.channelId;
            const artistUrl = channelId ? `https://music.youtube.com/channel/${channelId}` : undefined;
            const durationSeconds = durations.get(id);

            return {
                provider: "youtubeMusic",
                id,
                uri: buildYoutubeMusicUri(id),
                name: title,
                artists: channel ? [channel] : [],
                artistUrls: artistUrl ? [artistUrl] : undefined,
                thumbnail: pickThumbnail(item),
                durationMs: typeof durationSeconds === "number" ? durationSeconds * 1000 : undefined,
            } satisfies StreamingProviderTrack;
        })
        .filter((track): track is StreamingProviderTrack => Boolean(track));
}

export const youtubeMusicSearchProvider: StreamingProviderSearchProvider = {
    id: "youtubeMusic",
    searchMode: "submit",
    isEnabled$: isYoutubeMusicSearchEnabled$,
    async search({ query }: StreamingProviderSearchInput) {
        const trimmed = query.trim();
        if (!trimmed) {
            return [];
        }

        const tracks = await searchYoutubeMusicTracks(trimmed, DEFAULT_SEARCH_LIMIT);
        return tracks.map((track) => ({ type: "track", item: buildYoutubeMusicLocalTrack(track) }));
    },
};
