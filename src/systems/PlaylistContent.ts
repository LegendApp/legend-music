import { type Observable, observable } from "@legendapp/state";
import { type SyncTransform, synced } from "@legendapp/state/sync";
import { observablePersistExpoFS } from "@/utils/ExpoFSPersistPlugin";
import { type M3UPlaylist, parseM3U, writeM3U } from "@/utils/m3u";

// Cache for playlist observables to avoid creating duplicates
const playlistCache = new Map<string, Observable<M3UPlaylist>>();

// Transform for M3U format persistence
const m3uTransform: SyncTransform<M3UPlaylist, string> = {
	load: (value: string) => {
		if (typeof value === "string" && value.trim()) {
			try {
				return parseM3U(value);
			} catch (error) {
				console.warn("Failed to parse M3U content:", error);
			}
		}
		return { tracks: [] };
	},
	save: (value: M3UPlaylist) => {
		try {
			debugger;
			return writeM3U(value);
		} catch (error) {
			console.error("Failed to write M3U content:", error);
			return "";
		}
	},
};

/**
 * Get or create a synced observable for a playlist at the given path
 * The observable automatically persists in M3U format
 */
export function getPlaylistContent(
	playlistPath: string,
): Observable<M3UPlaylist> {
	// Check cache first
	if (playlistCache.has(playlistPath)) {
		return playlistCache.get(playlistPath)!;
	}

	// Create a cache key from the playlist path
	const cacheKey = playlistPath
		.replace(/[^a-z0-9]/gi, "_")
		.replace(/^_+/, "")
		.replace(/_+$/, "")
		.toLowerCase();

	// Create the synced observable
	const playlist$ = observable<M3UPlaylist>(
		synced({
			initial: { tracks: [] },
			persist: {
				name: `playlist_${cacheKey}`,
				plugin: observablePersistExpoFS({
					format: "m3u", // Store directly as M3U format
					preload: [`playlist_${cacheKey}`],
					saveTimeout: 500,
				}),
				transform: m3uTransform,
			},
		}),
	);

	// Initialize the observable
	playlist$.get();

	// Cache it
	playlistCache.set(playlistPath, playlist$);

	return playlist$;
}

/**
 * Clear cached playlist observable for a given path
 */
export function clearPlaylistCache(playlistPath: string): void {
	playlistCache.delete(playlistPath);
}

/**
 * Clear all cached playlist observables
 */
export function clearAllPlaylistCaches(): void {
	playlistCache.clear();
}

/**
 * Get all cached playlist paths
 */
export function getCachedPlaylistPaths(): string[] {
	return Array.from(playlistCache.keys());
}
