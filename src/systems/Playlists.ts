import { createJSONManager } from "@/utils/JSONManager";

export interface Playlist {
	id: string;
	name: string;
	path: string;
	count: number;
	type: "file" | "ytm";
}

export interface PlaylistsData {
	playlists: Record<string, Playlist>;
}

// Playlists persistence
export const playlistsData$ = createJSONManager<PlaylistsData>({
	filename: "playlists",
	initialValue: {
		playlists: {},
	},
});

// Add a new playlist
export function addPlaylist(playlist: Omit<Playlist, "id">): Playlist {
	const id = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	const newPlaylist: Playlist = {
		...playlist,
		id,
	};
	
	playlistsData$.playlists[id].set(newPlaylist);
	
	return newPlaylist;
}

// Remove a playlist
export function removePlaylist(id: string): void {
	playlistsData$.playlists[id].delete();
}

// Update a playlist
export function updatePlaylist(
	id: string,
	updates: Partial<Omit<Playlist, "id">>,
): void {
	const currentPlaylist = playlistsData$.playlists[id].get();
	if (currentPlaylist) {
		playlistsData$.playlists[id].set({ ...currentPlaylist, ...updates });
	}
}

// Get a playlist by ID
export function getPlaylist(id: string): Playlist | undefined {
	return playlistsData$.playlists[id].get();
}

// Get all playlists
export function getAllPlaylists(): Playlist[] {
	const playlistsObject = playlistsData$.playlists.get();
	return Object.values(playlistsObject);
}

// Get playlists by type
export function getPlaylistsByType(type: "file" | "ytm"): Playlist[] {
	const playlistsObject = playlistsData$.playlists.get();
	return Object.values(playlistsObject).filter((p) => p.type === type);
}
