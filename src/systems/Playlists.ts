import { createJSONManager } from "@/utils/JSONManager";

export interface Playlist {
    id: string;
    name: string;
    path: string;
    count: number;
    type: "file";
    order: number;
}

export interface PlaylistsData {
    playlistsLocal: Record<string, Playlist>;
}

// Playlists persistence
export const playlistsData$ = createJSONManager<PlaylistsData>({
    filename: "playlists",
    initialValue: {
        playlistsLocal: {},
    },
});

// Get a playlist by ID
export function getPlaylist(id: string): Playlist | undefined {
    return playlistsData$.playlistsLocal[id].get();
}

// Get all playlists
export function getAllPlaylists(): Playlist[] {
    const playlistsLocal = playlistsData$.playlistsLocal.get();
    return Object.values(playlistsLocal);
}

// Get playlists by type
export function getPlaylistsByType(type: "file"): Playlist[] {
    return Object.values(playlistsData$.playlistsLocal.get());
}
