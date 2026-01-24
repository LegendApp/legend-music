import { createJSONManager } from "@/utils/JSONManager";
import type { StreamingProviderPlaylist, StreamingProviderTrack } from "@/providers/types";

export interface AppleMusicState {
    playlists: StreamingProviderPlaylist[];
    playlistsFetchedAt: number | null;
    tracksByPlaylistId: Record<string, StreamingProviderTrack[]>;
    tracksFetchedAtByPlaylistId: Record<string, number>;
}

export const createAppleMusicState = (): AppleMusicState => ({
    playlists: [],
    playlistsFetchedAt: null,
    tracksByPlaylistId: {},
    tracksFetchedAtByPlaylistId: {},
});

export const appleMusicState$ = createJSONManager<AppleMusicState>({
    filename: "apple-music-playlists",
    initialValue: createAppleMusicState(),
});
