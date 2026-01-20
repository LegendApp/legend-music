import type { LocalTrack } from "@/systems/LocalMusicState";
import type { M3UTrack } from "@/utils/m3u";

const resolveTrackPath = (track: { filePath?: string; uri?: string; id?: string }): string | null => {
    return track.filePath || track.uri || track.id || null;
};

const buildM3UEntry = (
    track: { title?: string; artist?: string; durationMs?: number; thumbnail?: string },
    filePath: string,
): M3UTrack => ({
    id: filePath,
    filePath,
    title: track.title?.trim() || "Unknown Track",
    artist: track.artist?.trim() || undefined,
    duration:
        typeof track.durationMs === "number" && Number.isFinite(track.durationMs)
            ? Math.max(0, Math.round(track.durationMs / 1000))
            : -1,
    logo: track.thumbnail,
    addedAt: Date.now(),
});

export const buildPlaylistEntries = (
    tracks: LocalTrack[],
): { trackPaths: string[]; trackEntries: M3UTrack[] } => {
    const trackEntries: M3UTrack[] = [];
    const trackPaths = Array.from(
        new Set(
            tracks
                .map((track) => {
                    const path = resolveTrackPath(track);
                    if (path) {
                        trackEntries.push(buildM3UEntry(track, path));
                    }
                    return path;
                })
                .filter((path): path is string => Boolean(path)),
        ),
    );

    return { trackPaths, trackEntries };
};
