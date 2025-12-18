import { createJSONManager } from "@/utils/JSONManager";
import type { ProviderPlaylist, ProviderTrack } from "@/providers/types";

export interface SpotifyCachedSearch {
    query: string;
    tracks: ProviderTrack[];
    fetchedAt: number;
}

export interface SpotifyCachedPlaylist {
    playlist: ProviderPlaylist;
    fetchedAt: number;
}

interface SpotifyCacheState {
    searches: Record<string, SpotifyCachedSearch>;
    playlists: Record<string, SpotifyCachedPlaylist>;
}

export const spotifyCache$ = createJSONManager<SpotifyCacheState>({
    filename: "spotify-cache",
    initialValue: {
        searches: {},
        playlists: {},
    },
});

export function cacheSearchResult(query: string, tracks: ProviderTrack[]): void {
    spotifyCache$.searches[query].set({
        query,
        tracks,
        fetchedAt: Date.now(),
    });
}

export function getCachedSearch(query: string): SpotifyCachedSearch | null {
    const entry = spotifyCache$.searches[query].get();
    if (!entry) {
        return null;
    }
    return entry as SpotifyCachedSearch;
}

export function cachePlaylist(playlist: ProviderPlaylist): void {
    spotifyCache$.playlists[playlist.id].set({
        playlist,
        fetchedAt: Date.now(),
    });
}

export function getCachedPlaylist(id: string): SpotifyCachedPlaylist | null {
    const entry = spotifyCache$.playlists[id].get();
    return entry ? (entry as SpotifyCachedPlaylist) : null;
}
