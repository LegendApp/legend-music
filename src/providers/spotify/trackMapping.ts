import type { ProviderTrack } from "@/providers/types";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { formatSecondsToMmSs } from "@/utils/m3u";

type SpotifyTrackMappingOptions = {
    index?: number;
};

export function buildSpotifyLocalTrack(track: ProviderTrack, options: SpotifyTrackMappingOptions = {}): LocalTrack {
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
        provider: "spotify",
        uri: track.uri,
        durationMs: track.durationMs,
        trackNumber,
        addedAt: track.addedAt,
        popularity: track.popularity,
    };
}
