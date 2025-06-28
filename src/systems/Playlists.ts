import type { YTMusicPlaylist } from "@/components/YouTubeMusicPlayer";
import { createJSONManager } from "@/utils/JSONManager";

export interface Playlist {
    id: string;
    name: string;
    path: string;
    count: number;
    type: "file" | "ytm";
    order: number;
    index?: number; // For YTM playlists, the sidebar index for opening
}

export interface PlaylistsData {
    playlistsLocal: Record<string, Playlist>;
    playlistsYtm: Record<string, YTMusicPlaylist>;
}

// Playlists persistence
export const playlistsData$ = createJSONManager<PlaylistsData>({
    filename: "playlists",
    initialValue: {
        playlistsLocal: {},
        playlistsYtm: {},
    },
});

// Get a playlist by ID
export function getPlaylist(id: string): Playlist | undefined {
    return playlistsData$.playlistsLocal[id].get() ?? playlistsData$.playlistsYtm[id].get();
}

// Get all playlists
export function getAllPlaylists(): (Playlist | YTMusicPlaylist)[] {
    const playlistsLocal = playlistsData$.playlistsLocal.get();
    const playlistsYtm = playlistsData$.playlistsYtm.get();
    return [...Object.values(playlistsLocal), ...Object.values(playlistsYtm)];
}

// Get playlists by type
export function getPlaylistsByType(type: "file" | "ytm"): Playlist[] {
    if (type === "file") {
        return Object.values(playlistsData$.playlistsLocal.get());
    }
    return Object.values(playlistsData$.playlistsYtm.get());
}
