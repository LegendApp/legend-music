import type { LocalTrack } from "@/systems/LocalMusicState";

export type SpotifyPlaybackState = {
    position?: number;
    duration?: number;
    paused?: boolean;
    track_window?: {
        current_track?: {
            uri?: string;
            id?: string;
            album?: {
                images?: ({ url?: string } | string)[];
            };
        };
    };
};

export const normalizeSpotifyTrackId = (value: string): string => value.replace(/^spotify:track:/i, "");

export const getSpotifyTrackId = (track: LocalTrack | null | undefined): string | null => {
    if (!track) {
        return null;
    }
    return track.uri || track.id || track.filePath || null;
};

export const getSpotifyStateTrackId = (state: SpotifyPlaybackState): string | null =>
    state.track_window?.current_track?.uri || state.track_window?.current_track?.id || null;

export const getSpotifyStateArtwork = (state: SpotifyPlaybackState): string | null => {
    const image = state.track_window?.current_track?.album?.images?.[0];
    if (!image) {
        return null;
    }
    return typeof image === "string" ? image : image.url ?? null;
};

export const getSpotifyTrackKey = (track: LocalTrack | null | undefined): string | null => {
    const trackId = getSpotifyTrackId(track);
    return trackId ? normalizeSpotifyTrackId(trackId) : null;
};

export const getSpotifyStateTrackKey = (state: SpotifyPlaybackState): string | null => {
    const trackId = getSpotifyStateTrackId(state);
    return trackId ? normalizeSpotifyTrackId(trackId) : null;
};
