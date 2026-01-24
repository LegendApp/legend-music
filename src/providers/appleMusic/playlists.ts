import type { StreamingProviderPlaylist, StreamingProviderTrack } from "@/providers/types";
import { ensureAppleMusicDeveloperToken } from "@/providers/appleMusic/auth";
import { appleMusicAuthState$ } from "@/providers/appleMusic/authState";
import { APPLE_MUSIC_API_BASE } from "@/providers/appleMusic/constants";
import { appleMusicPlaylists$, appleMusicPlaylistsStatus$ } from "@/providers/appleMusic/playlistsState";

type AppleMusicArtwork = {
    url?: string;
    width?: number;
    height?: number;
};

type AppleMusicPlaylistAttributes = {
    name?: string;
    trackCount?: number;
    curatorName?: string;
    artwork?: AppleMusicArtwork;
};

type AppleMusicPlaylist = {
    id: string;
    type?: string;
    attributes?: AppleMusicPlaylistAttributes;
};

type AppleMusicTrackAttributes = {
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    contentRating?: string;
    isExplicit?: boolean;
    artwork?: AppleMusicArtwork;
    playParams?: {
        id?: string;
        catalogId?: string;
        kind?: string;
    };
    dateAdded?: string;
};

type AppleMusicTrack = {
    id: string;
    type?: string;
    attributes?: AppleMusicTrackAttributes;
};

type AppleMusicPlaylistResponse = {
    data?: AppleMusicPlaylist[];
    next?: string | null;
};

type AppleMusicPlaylistTracksResponse = {
    data?: AppleMusicTrack[];
    next?: string | null;
};

const PLAYLIST_PAGE_LIMIT = 50;
const TRACK_PAGE_LIMIT = 100;

const resolveArtworkUrl = (artwork?: AppleMusicArtwork): string | undefined => {
    if (!artwork?.url) {
        return undefined;
    }

    return artwork.url
        .replace("{w}", "300")
        .replace("{h}", "300")
        .replace("{f}", "jpg");
};

const resolveNextUrl = (next?: string | null): string | null => {
    if (!next) {
        return null;
    }

    if (next.startsWith("http")) {
        return next;
    }

    return `${APPLE_MUSIC_API_BASE}${next}`;
};

const toAppleMusicPlaylistUri = (playlistId: string): string => `apple-music:playlist:${playlistId}`;
const toAppleMusicTrackUri = (trackId: string): string => `apple-music:track:${trackId}`;

const mapAppleMusicPlaylist = (playlist: AppleMusicPlaylist): StreamingProviderPlaylist => {
    const artworkUrl = resolveArtworkUrl(playlist.attributes?.artwork);
    return {
        provider: "appleMusic",
        id: playlist.id,
        uri: toAppleMusicPlaylistUri(playlist.id),
        name: playlist.attributes?.name ?? "Untitled Playlist",
        owner: playlist.attributes?.curatorName,
        trackCount: playlist.attributes?.trackCount,
        images: artworkUrl ? [artworkUrl] : [],
        isEditable: false,
    };
};

const mapAppleMusicTrack = (track: AppleMusicTrack): StreamingProviderTrack | null => {
    if (!track) {
        return null;
    }

    if (track.type && track.type !== "songs" && track.type !== "library-songs") {
        return null;
    }

    const playParams = track.attributes?.playParams;
    const resolvedId = playParams?.catalogId ?? playParams?.id ?? track.id;
    if (!resolvedId) {
        return null;
    }

    const addedAt = track.attributes?.dateAdded ? Date.parse(track.attributes.dateAdded) : null;
    const artworkUrl = resolveArtworkUrl(track.attributes?.artwork);
    const isExplicit =
        track.attributes?.isExplicit === true ||
        track.attributes?.contentRating?.toLowerCase() === "explicit";

    return {
        provider: "appleMusic",
        id: resolvedId,
        uri: toAppleMusicTrackUri(resolvedId),
        name: track.attributes?.name ?? "Unknown Track",
        durationMs: track.attributes?.durationInMillis,
        artists: track.attributes?.artistName ? [track.attributes.artistName] : [],
        album: track.attributes?.albumName,
        thumbnail: artworkUrl,
        isExplicit,
        addedAt: addedAt && Number.isFinite(addedAt) ? addedAt : undefined,
    };
};

const fetchAppleMusicJson = async <T>(url: string, developerToken: string, userToken: string): Promise<T> => {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${developerToken}`,
            "Music-User-Token": userToken,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Apple Music API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
};

const refreshAppleMusicPlaylists = async (options: { showLoading: boolean }): Promise<StreamingProviderPlaylist[]> => {
    if (options.showLoading) {
        appleMusicPlaylistsStatus$.isLoading.set(true);
    }
    appleMusicPlaylistsStatus$.error.set(null);

    try {
        const developerToken = await ensureAppleMusicDeveloperToken();
        const userToken = appleMusicAuthState$.userToken.peek();
        if (!developerToken || !userToken) {
            throw new Error("Apple Music login required to load playlists");
        }

        const playlists: StreamingProviderPlaylist[] = [];
        let nextUrl: string | null = `${APPLE_MUSIC_API_BASE}/me/library/playlists?limit=${PLAYLIST_PAGE_LIMIT}`;

        while (nextUrl) {
            const payload = await fetchAppleMusicJson<AppleMusicPlaylistResponse>(nextUrl, developerToken, userToken);
            const items = payload.data ?? [];
            playlists.push(...items.map(mapAppleMusicPlaylist));
            nextUrl = resolveNextUrl(payload.next);
        }

        appleMusicPlaylists$.playlists.set(playlists);
        appleMusicPlaylists$.playlistsFetchedAt.set(Date.now());
        return playlists;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load Apple Music playlists";
        appleMusicPlaylistsStatus$.error.set(message);
        if (options.showLoading) {
            throw error;
        }
        return appleMusicPlaylists$.playlists.peek();
    } finally {
        if (options.showLoading) {
            appleMusicPlaylistsStatus$.isLoading.set(false);
        }
    }
};

export async function fetchAppleMusicPlaylists(
    options: { force?: boolean } = {},
): Promise<StreamingProviderPlaylist[]> {
    const cachedAt = appleMusicPlaylists$.playlistsFetchedAt.peek();
    const cachedPlaylists = appleMusicPlaylists$.playlists.peek();
    const hasCached = Boolean(cachedAt) || cachedPlaylists.length > 0;

    if (!options.force && hasCached) {
        void refreshAppleMusicPlaylists({ showLoading: false });
        return cachedPlaylists;
    }

    return refreshAppleMusicPlaylists({ showLoading: true });
}

export async function fetchAppleMusicPlaylistTracks(
    playlistId: string,
    options: { force?: boolean } = {},
): Promise<StreamingProviderTrack[]> {
    const cachedAt = appleMusicPlaylists$.tracksFetchedAtByPlaylistId[playlistId].peek();
    if (!options.force && cachedAt) {
        return appleMusicPlaylists$.tracksByPlaylistId[playlistId].peek() ?? [];
    }

    const developerToken = await ensureAppleMusicDeveloperToken();
    const userToken = appleMusicAuthState$.userToken.peek();
    if (!developerToken || !userToken) {
        throw new Error("Apple Music login required to load playlist tracks");
    }

    appleMusicPlaylistsStatus$.tracksLoading[playlistId].set(true);
    appleMusicPlaylistsStatus$.tracksError[playlistId].set(null);

    try {
        const tracks: StreamingProviderTrack[] = [];
        let nextUrl: string | null = `${APPLE_MUSIC_API_BASE}/me/library/playlists/${encodeURIComponent(
            playlistId,
        )}/tracks?limit=${TRACK_PAGE_LIMIT}`;

        while (nextUrl) {
            const payload = await fetchAppleMusicJson<AppleMusicPlaylistTracksResponse>(
                nextUrl,
                developerToken,
                userToken,
            );
            const items = payload.data ?? [];
            for (const item of items) {
                const mapped = mapAppleMusicTrack(item);
                if (mapped) {
                    tracks.push(mapped);
                }
            }
            nextUrl = resolveNextUrl(payload.next);
        }

        appleMusicPlaylists$.tracksByPlaylistId[playlistId].set(tracks);
        appleMusicPlaylists$.tracksFetchedAtByPlaylistId[playlistId].set(Date.now());
        return tracks;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load Apple Music playlist tracks";
        appleMusicPlaylistsStatus$.tracksError[playlistId].set(message);
        throw error;
    } finally {
        appleMusicPlaylistsStatus$.tracksLoading[playlistId].set(false);
    }
}
