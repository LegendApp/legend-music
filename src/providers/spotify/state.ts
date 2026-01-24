import { createJSONManager } from "@/utils/JSONManager";
import type { StreamingProviderPlaylist, StreamingProviderTrack } from "@/providers/types";

export interface SpotifyState {
    playlists: StreamingProviderPlaylist[];
    playlistsFetchedAt: number | null;
    tracksByPlaylistId: Record<string, StreamingProviderTrack[]>;
    tracksFetchedAtByPlaylistId: Record<string, number>;
}

export const createSpotifyState = (): SpotifyState => ({
    playlists: [],
    playlistsFetchedAt: null,
    tracksByPlaylistId: {},
    tracksFetchedAtByPlaylistId: {},
});

export const spotifyState$ = createJSONManager<SpotifyState>({
    filename: "spotify-playlists",
    initialValue: createSpotifyState(),
});
