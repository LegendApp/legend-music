import { Linking } from "react-native";
import { SpotifySourceBadge } from "@/components/SpotifySourceBadge";
import type { ContextMenuItem } from "@/native-modules/ContextMenu";
import type { ProviderPlugin } from "@/providers/pluginRegistry";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { isSpotifyAuthenticated$ } from "@/providers/spotify/authState";
import { spotifyPlaybackProvider } from "@/providers/spotify/playbackProvider";
import { fetchSpotifyPlaylistTracks, fetchSpotifyPlaylists } from "@/providers/spotify/playlists";
import { spotifyPlaylists$, spotifyPlaylistsStatus$ } from "@/providers/spotify/playlistsState";
import { spotifyProvider } from "@/providers/spotify/provider";
import { spotifySearchProvider } from "@/providers/spotify/search";
import { SpotifyWebPlayerBridge } from "@/providers/spotify/SpotifyWebPlayerBridge";
import { buildSpotifyLocalTrack } from "@/providers/spotify/trackMapping";
import { SpotifySettings } from "@/settings/SpotifySettings";

const SPOTIFY_CONTEXT_MENU_ITEMS = {
    openArtist: { id: "spotify-open-artist", title: "Open Artist in Browser" } as const,
    openAlbum: { id: "spotify-open-album", title: "Open Album in Browser" } as const,
};

const isSpotifyUri = (value: string): boolean => value.toLowerCase().startsWith("spotify:");

const buildSpotifySearchUrl = (value: string): string => `https://open.spotify.com/search/${encodeURIComponent(value)}`;

const getSpotifyArtistUrl = (track: LocalTrack): string | null =>
    track.artistUrls?.[0] ?? (track.artist ? buildSpotifySearchUrl(track.artist) : null);

const getSpotifyAlbumUrl = (track: LocalTrack): string | null =>
    track.albumUrl ?? (track.album ? buildSpotifySearchUrl(track.album) : null);

const openExternalUrl = async (url: string): Promise<boolean> => {
    try {
        await Linking.openURL(url);
        return true;
    } catch (error) {
        console.warn("Failed to open Spotify URL", error);
        return false;
    }
};

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
    trackContextMenu: {
        getItems: (track) => {
            const items: ContextMenuItem[] = [];
            if (getSpotifyArtistUrl(track)) {
                items.push(SPOTIFY_CONTEXT_MENU_ITEMS.openArtist);
            }
            if (getSpotifyAlbumUrl(track)) {
                items.push(SPOTIFY_CONTEXT_MENU_ITEMS.openAlbum);
            }
            return items;
        },
        onSelect: async (selection, track) => {
            if (selection === SPOTIFY_CONTEXT_MENU_ITEMS.openArtist.id) {
                const url = getSpotifyArtistUrl(track);
                return url ? openExternalUrl(url) : false;
            }
            if (selection === SPOTIFY_CONTEXT_MENU_ITEMS.openAlbum.id) {
                const url = getSpotifyAlbumUrl(track);
                return url ? openExternalUrl(url) : false;
            }
            return false;
        },
    },
    ui: {
        bridge: SpotifyWebPlayerBridge,
        settings: SpotifySettings,
        badge: SpotifySourceBadge,
    },
};
