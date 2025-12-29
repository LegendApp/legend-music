import { observable } from "@legendapp/state";
import { createSpotifyState, spotifyState$ } from "@/providers/spotify/state";

export const spotifyPlaylists$ = spotifyState$;

export const spotifyPlaylistsStatus$ = observable({
    isLoading: false,
    error: null as string | null,
    tracksLoading: {} as Record<string, boolean>,
    tracksError: {} as Record<string, string | null>,
});

export function clearSpotifyPlaylistsCache(): void {
    spotifyPlaylists$.set(createSpotifyState());
    spotifyPlaylistsStatus$.isLoading.set(false);
    spotifyPlaylistsStatus$.error.set(null);
    spotifyPlaylistsStatus$.tracksLoading.set({});
    spotifyPlaylistsStatus$.tracksError.set({});
}
