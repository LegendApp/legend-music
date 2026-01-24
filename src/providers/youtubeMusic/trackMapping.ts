import type { StreamingProviderTrack } from "@/providers/types";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { formatSecondsToMmSs } from "@/utils/m3u";

const YOUTUBE_MUSIC_URI_PREFIX = "ytm:";
const YOUTUBE_MUSIC_HOST = "music.youtube.com";
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const buildYoutubeMusicUri = (id: string): string => `${YOUTUBE_MUSIC_URI_PREFIX}${id}`;

export const getYoutubeMusicVideoId = (value?: string | null): string | null => {
    if (!value) {
        return null;
    }

    if (value.startsWith(YOUTUBE_MUSIC_URI_PREFIX)) {
        const id = value.slice(YOUTUBE_MUSIC_URI_PREFIX.length);
        return id.length > 0 ? id : null;
    }

    if (value.includes(YOUTUBE_MUSIC_HOST)) {
        try {
            const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
            const id = parsed.searchParams.get("v");
            return id && id.length > 0 ? id : null;
        } catch (_error) {
            return null;
        }
    }

    if (value.startsWith("/") || value.startsWith("file://") || /^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
        return null;
    }

    return YOUTUBE_VIDEO_ID_PATTERN.test(value) ? value : null;
};

export function buildYoutubeMusicLocalTrack(track: StreamingProviderTrack): LocalTrack {
    const durationSeconds = typeof track.durationMs === "number" ? track.durationMs / 1000 : 0;
    const duration = durationSeconds ? formatSecondsToMmSs(durationSeconds) : " ";
    const uri = track.uri ?? buildYoutubeMusicUri(track.id);

    return {
        id: uri,
        title: track.name,
        artist: (track.artists ?? []).join(", ") || "YouTube Music",
        album: track.album,
        albumUrl: track.albumUrl,
        duration,
        filePath: uri,
        fileName: track.name,
        thumbnail: track.thumbnail,
        artistUrls: track.artistUrls,
        provider: "youtubeMusic",
        uri,
        durationMs: track.durationMs,
    };
}
