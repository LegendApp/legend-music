import type { ProviderTrack } from "@/providers/types";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { formatSecondsToMmSs } from "@/utils/m3u";

const YOUTUBE_MUSIC_URI_PREFIX = "ytm:";

export const buildYoutubeMusicUri = (id: string): string => `${YOUTUBE_MUSIC_URI_PREFIX}${id}`;

export const getYoutubeMusicVideoId = (value?: string | null): string | null => {
    if (!value) {
        return null;
    }

    if (value.startsWith(YOUTUBE_MUSIC_URI_PREFIX)) {
        return value.slice(YOUTUBE_MUSIC_URI_PREFIX.length) || null;
    }

    if (value.includes("music.youtube.com")) {
        try {
            const parsed = new URL(value);
            return parsed.searchParams.get("v");
        } catch (_error) {
            return null;
        }
    }

    return value;
};

export function buildYoutubeMusicLocalTrack(track: ProviderTrack): LocalTrack {
    const durationSeconds = typeof track.durationMs === "number" ? track.durationMs / 1000 : 0;
    const duration = durationSeconds ? formatSecondsToMmSs(durationSeconds) : " ";
    const uri = track.uri ?? buildYoutubeMusicUri(track.id);

    return {
        id: uri,
        title: track.name,
        artist: (track.artists ?? []).join(", ") || "YouTube Music",
        album: track.album,
        duration,
        filePath: uri,
        fileName: track.name,
        thumbnail: track.thumbnail,
        provider: "youtubeMusic",
        uri,
        durationMs: track.durationMs,
    };
}
