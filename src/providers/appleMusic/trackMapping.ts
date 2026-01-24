import type { StreamingProviderTrack } from "@/providers/types";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { formatSecondsToMmSs } from "@/utils/m3u";

type AppleMusicTrackMappingOptions = {
    index?: number;
};

const APPLE_MUSIC_TRACK_PREFIX = "apple-music:track:";

export const isAppleMusicUri = (value: string): boolean => value.toLowerCase().startsWith("apple-music:");

export const getAppleMusicTrackId = (value: string | null | undefined): string | null => {
    if (!value) {
        return null;
    }

    const lower = value.toLowerCase();
    if (lower.startsWith(APPLE_MUSIC_TRACK_PREFIX)) {
        return value.slice(APPLE_MUSIC_TRACK_PREFIX.length);
    }

    return value;
};

export function buildAppleMusicLocalTrack(
    track: StreamingProviderTrack,
    options: AppleMusicTrackMappingOptions = {},
): LocalTrack {
    const durationSeconds = typeof track.durationMs === "number" ? track.durationMs / 1000 : 0;
    const duration = durationSeconds ? formatSecondsToMmSs(durationSeconds) : " ";
    const uri = track.uri ?? track.id;
    const trackNumber = typeof options.index === "number" ? options.index + 1 : undefined;

    return {
        id: uri,
        title: track.name,
        artist: (track.artists ?? []).join(", "),
        album: track.album,
        albumUrl: track.albumUrl,
        duration,
        filePath: uri,
        fileName: track.name,
        thumbnail: track.thumbnail,
        artistUrls: track.artistUrls,
        provider: "appleMusic",
        uri: track.uri,
        durationMs: track.durationMs,
        trackNumber,
        addedAt: track.addedAt,
    };
}
