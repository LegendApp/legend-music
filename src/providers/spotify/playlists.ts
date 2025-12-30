import type { ProviderPlaylist, ProviderTrack } from "@/providers/types";
import { ensureSpotifyAccessToken } from "@/providers/spotify/auth";
import { SPOTIFY_API_BASE } from "@/providers/spotify/constants";
import { spotifyPlaylists$, spotifyPlaylistsStatus$ } from "@/providers/spotify/playlistsState";

type SpotifyPlaylistImage = {
    url: string;
};

type SpotifyPlaylistOwner = {
    display_name?: string;
    id?: string;
};

type SpotifyPlaylist = {
    id: string;
    name: string;
    uri: string;
    owner?: SpotifyPlaylistOwner;
    tracks?: { total?: number };
    images?: SpotifyPlaylistImage[];
};

type SpotifyPlaylistResponse = {
    items?: SpotifyPlaylist[];
    next?: string | null;
};

type SpotifyTrack = {
    id?: string;
    name?: string;
    uri?: string;
    duration_ms?: number;
    explicit?: boolean;
    artists?: { name: string }[];
    album?: { name?: string; images?: SpotifyPlaylistImage[] };
    type?: string;
};

type SpotifyPlaylistTrackItem = {
    added_at?: string | null;
    track?: SpotifyTrack | null;
};

type SpotifyPlaylistTracksResponse = {
    items?: SpotifyPlaylistTrackItem[];
    next?: string | null;
};

const PLAYLIST_PAGE_LIMIT = 50;
const TRACK_PAGE_LIMIT = 100;

const mapSpotifyPlaylist = (playlist: SpotifyPlaylist): ProviderPlaylist => ({
    provider: "spotify",
    id: playlist.id,
    uri: playlist.uri,
    name: playlist.name,
    owner: playlist.owner?.display_name ?? playlist.owner?.id,
    trackCount: playlist.tracks?.total,
    images: playlist.images?.map((image) => image.url) ?? [],
    isEditable: false,
});

const mapSpotifyTrack = (track: SpotifyTrack | null | undefined): ProviderTrack | null => {
    if (!track) {
        return null;
    }

    if (track.type && track.type !== "track") {
        return null;
    }

    if (!track.uri) {
        return null;
    }

    const id = track.id ?? track.uri;

    return {
        provider: "spotify",
        id,
        uri: track.uri,
        name: track.name ?? "Unknown Track",
        durationMs: track.duration_ms,
        artists: track.artists?.map((artist) => artist.name) ?? [],
        album: track.album?.name,
        thumbnail: track.album?.images?.[0]?.url,
        isExplicit: track.explicit,
    };
};

const fetchSpotifyJson = async <T>(url: string, token: string): Promise<T> => {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Spotify API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
};

const refreshSpotifyPlaylists = async (options: { showLoading: boolean }): Promise<ProviderPlaylist[]> => {
    if (options.showLoading) {
        spotifyPlaylistsStatus$.isLoading.set(true);
    }
    spotifyPlaylistsStatus$.error.set(null);

    try {
        const token = await ensureSpotifyAccessToken();
        if (!token) {
            throw new Error("Spotify login required to load playlists");
        }
        const playlists: ProviderPlaylist[] = [];
        let nextUrl: string | null = `${SPOTIFY_API_BASE}/me/playlists?limit=${PLAYLIST_PAGE_LIMIT}`;

        while (nextUrl) {
            const payload = await fetchSpotifyJson<SpotifyPlaylistResponse>(nextUrl, token);
            const items = payload.items ?? [];
            playlists.push(...items.map(mapSpotifyPlaylist));
            nextUrl = payload.next ?? null;
        }

        spotifyPlaylists$.playlists.set(playlists);
        spotifyPlaylists$.playlistsFetchedAt.set(Date.now());
        return playlists;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load Spotify playlists";
        spotifyPlaylistsStatus$.error.set(message);
        if (options.showLoading) {
            throw error;
        }
        return spotifyPlaylists$.playlists.peek();
    } finally {
        if (options.showLoading) {
            spotifyPlaylistsStatus$.isLoading.set(false);
        }
    }
};

export async function fetchSpotifyPlaylists(options: { force?: boolean } = {}): Promise<ProviderPlaylist[]> {
    const cachedAt = spotifyPlaylists$.playlistsFetchedAt.peek();
    const cachedPlaylists = spotifyPlaylists$.playlists.peek();
    const hasCached = Boolean(cachedAt) || cachedPlaylists.length > 0;

    if (!options.force && hasCached) {
        void refreshSpotifyPlaylists({ showLoading: false });
        return cachedPlaylists;
    }

    return refreshSpotifyPlaylists({ showLoading: true });
}

export async function fetchSpotifyPlaylistTracks(
    playlistId: string,
    options: { force?: boolean } = {},
): Promise<ProviderTrack[]> {
    const cachedAt = spotifyPlaylists$.tracksFetchedAtByPlaylistId[playlistId].peek();
    if (!options.force && cachedAt) {
        return spotifyPlaylists$.tracksByPlaylistId[playlistId].peek() ?? [];
    }

    const token = await ensureSpotifyAccessToken();
    if (!token) {
        throw new Error("Spotify login required to load playlist tracks");
    }

    spotifyPlaylistsStatus$.tracksLoading[playlistId].set(true);
    spotifyPlaylistsStatus$.tracksError[playlistId].set(null);

    try {
        const tracks: ProviderTrack[] = [];
        let nextUrl: string | null = `${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(
            playlistId,
        )}/tracks?limit=${TRACK_PAGE_LIMIT}`;

        while (nextUrl) {
            const payload = await fetchSpotifyJson<SpotifyPlaylistTracksResponse>(nextUrl, token);
            const items = payload.items ?? [];
            for (const item of items) {
                const mapped = mapSpotifyTrack(item.track);
                if (mapped) {
                    if (item.added_at) {
                        const addedAt = Date.parse(item.added_at);
                        if (Number.isFinite(addedAt)) {
                            mapped.addedAt = addedAt;
                        }
                    }
                    tracks.push(mapped);
                }
            }
            nextUrl = payload.next ?? null;
        }

        spotifyPlaylists$.tracksByPlaylistId[playlistId].set(tracks);
        spotifyPlaylists$.tracksFetchedAtByPlaylistId[playlistId].set(Date.now());
        return tracks;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load Spotify playlist tracks";
        spotifyPlaylistsStatus$.tracksError[playlistId].set(message);
        throw error;
    } finally {
        spotifyPlaylistsStatus$.tracksLoading[playlistId].set(false);
    }
}
