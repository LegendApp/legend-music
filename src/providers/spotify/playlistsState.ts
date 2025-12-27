import { observable } from "@legendapp/state";
import type { ProviderPlaylist, ProviderTrack } from "@/providers/types";
import { createJSONManager } from "@/utils/JSONManager";

export interface SpotifyPlaylistsState {
    playlists: ProviderPlaylist[];
    playlistsFetchedAt: number | null;
    tracksByPlaylistId: Record<string, ProviderTrack[]>;
    tracksFetchedAtByPlaylistId: Record<string, number>;
}

const createInitialState = (): SpotifyPlaylistsState => ({
    playlists: [],
    playlistsFetchedAt: null,
    tracksByPlaylistId: {},
    tracksFetchedAtByPlaylistId: {},
});

export const spotifyPlaylists$ = createJSONManager<SpotifyPlaylistsState>({
    filename: "spotify-playlists",
    initialValue: createInitialState(),
});

export const spotifyPlaylistsStatus$ = observable({
    isLoading: false,
    error: null as string | null,
    tracksLoading: {} as Record<string, boolean>,
    tracksError: {} as Record<string, string | null>,
});

export function clearSpotifyPlaylistsCache(): void {
    spotifyPlaylists$.set(createInitialState());
    spotifyPlaylistsStatus$.isLoading.set(false);
    spotifyPlaylistsStatus$.error.set(null);
    spotifyPlaylistsStatus$.tracksLoading.set({});
    spotifyPlaylistsStatus$.tracksError.set({});
}
