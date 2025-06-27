import { createJSONManager } from "@/utils/JSONManager";

export interface Playlist {
	id: string;
	name: string;
	path: string;
	count: number;
	type: "file" | "ytm";
}

export interface PlaylistsData {
	playlists: Playlist[];
}

// Playlists persistence
export const playlists$ = createJSONManager<PlaylistsData>({
	filename: "playlists",
	initialValue: {
		playlists: [],
	},
});

// Add a new playlist
export function addPlaylist(playlist: Omit<Playlist, "id">): string {
	const id = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	const newPlaylist: Playlist = {
		...playlist,
		id,
	};
	
	const current = playlists$.get();
	playlists$.set({
		playlists: [...current.playlists, newPlaylist],
	});
	
	return id;
}

// Remove a playlist
export function removePlaylist(id: string): void {
	const current = playlists$.get();
	playlists$.set({
		playlists: current.playlists.filter(p => p.id !== id),
	});
}

// Update a playlist
export function updatePlaylist(id: string, updates: Partial<Omit<Playlist, "id">>): void {
	const current = playlists$.get();
	playlists$.set({
		playlists: current.playlists.map(p => 
			p.id === id ? { ...p, ...updates } : p
		),
	});
}

// Get a playlist by ID
export function getPlaylist(id: string): Playlist | undefined {
	const current = playlists$.get();
	return current.playlists.find(p => p.id === id);
}

// Get all playlists
export function getAllPlaylists(): Playlist[] {
	return playlists$.playlists.get();
}

// Get playlists by type
export function getPlaylistsByType(type: "file" | "ytm"): Playlist[] {
	return playlists$.playlists.get().filter(p => p.type === type);
}