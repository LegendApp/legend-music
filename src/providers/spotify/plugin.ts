import type { ProviderPlugin } from "@/providers/pluginRegistry";
import { isSpotifyAuthenticated$ } from "@/providers/spotify/authState";
import { spotifyPlaybackProvider } from "@/providers/spotify/playbackProvider";
import { fetchSpotifyPlaylistTracks, fetchSpotifyPlaylists } from "@/providers/spotify/playlists";
import { spotifyPlaylists$, spotifyPlaylistsStatus$ } from "@/providers/spotify/playlistsState";
import { spotifyProvider } from "@/providers/spotify/provider";
import { spotifySearchProvider } from "@/providers/spotify/search";
import { buildSpotifyLocalTrack } from "@/providers/spotify/trackMapping";

const isSpotifyUri = (value: string): boolean => value.toLowerCase().startsWith("spotify:");

export const spotifyPlugin: ProviderPlugin = {
    provider: spotifyProvider,
    search: spotifySearchProvider,
    playback: spotifyPlaybackProvider,
    library: {
        sync: async () => {
            if (!isSpotifyAuthenticated$.get()) {
                return;
            }

            try {
                await fetchSpotifyPlaylists();
            } catch (error) {
                console.warn("Failed to sync Spotify playlists", error);
            }
        },
        listPlaylists: fetchSpotifyPlaylists,
        listPlaylistTracks: fetchSpotifyPlaylistTracks,
        playlists$: spotifyPlaylists$.playlists,
        status$: spotifyPlaylistsStatus$,
    },
    tracks: {
        isUri: isSpotifyUri,
        toLocalTrack: (track, options) => buildSpotifyLocalTrack(track, options),
    },
};
