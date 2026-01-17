import { createJSONManager } from "@/utils/JSONManager";
import type { ProviderPlaylist, ProviderTrack } from "@/providers/types";

export interface AppleMusicState {
    playlists: ProviderPlaylist[];
    playlistsFetchedAt: number | null;
    tracksByPlaylistId: Record<string, ProviderTrack[]>;
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
