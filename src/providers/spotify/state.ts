import { createJSONManager } from "@/utils/JSONManager";
import type { ProviderPlaylist, ProviderTrack } from "@/providers/types";

export interface SpotifyState {
    playlists: ProviderPlaylist[];
    playlistsFetchedAt: number | null;
    tracksByPlaylistId: Record<string, ProviderTrack[]>;
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
