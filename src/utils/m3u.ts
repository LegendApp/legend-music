export interface M3UTrack {
	duration: number; // Duration in seconds, -1 for unknown
	title: string;
	artist?: string;
	filePath: string;
}

export interface M3UPlaylist {
	tracks: M3UTrack[];
}

/**
 * Parse M3U playlist content into a typed JavaScript object
 */
export function parseM3U(content: string): M3UPlaylist {
	const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
	const tracks: M3UTrack[] = [];
	
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		
		// Skip comments that aren't EXTINF
		if (line.startsWith('#') && !line.startsWith('#EXTINF:')) {
			i++;
			continue;
		}
		
		// Parse EXTINF line
		if (line.startsWith('#EXTINF:')) {
			const extinfMatch = line.match(/^#EXTINF:(-?\d+),(.*)$/);
			if (extinfMatch && i + 1 < lines.length) {
				const duration = parseInt(extinfMatch[1], 10);
				const titleInfo = extinfMatch[2].trim();
				const filePath = lines[i + 1];
				
				// Parse artist and title from the title info
				let title = titleInfo;
				let artist: string | undefined;
				
				// Check for "Artist - Title" format
				if (titleInfo.includes(' - ')) {
					const [artistPart, titlePart] = titleInfo.split(' - ', 2);
					artist = artistPart.trim();
					title = titlePart.trim();
				}
				
				tracks.push({
					duration,
					title,
					artist,
					filePath,
				});
				
				i += 2; // Skip the file path line
			} else {
				i++;
			}
		} else {
			// Plain file path without EXTINF
			tracks.push({
				duration: -1,
				title: extractTitleFromPath(line),
				filePath: line,
			});
			i++;
		}
	}
	
	return { tracks };
}

/**
 * Convert a typed JavaScript object to M3U playlist content
 */
export function writeM3U(playlist: M3UPlaylist): string {
	const lines: string[] = ['#EXTM3U'];
	
	for (const track of playlist.tracks) {
		// Create the title info
		let titleInfo = track.title;
		if (track.artist) {
			titleInfo = `${track.artist} - ${track.title}`;
		}
		
		// Add EXTINF line
		lines.push(`#EXTINF:${track.duration},${titleInfo}`);
		
		// Add file path
		lines.push(track.filePath);
	}
	
	return lines.join('\n') + '\n';
}

/**
 * Extract a title from a file path
 */
function extractTitleFromPath(filePath: string): string {
	// Get the filename without path
	const filename = filePath.split('/').pop() || filePath;
	
	// Remove extension
	const nameWithoutExtension = filename.replace(/\.[^.]*$/, '');
	
	// Decode URL-encoded characters
	try {
		return decodeURIComponent(nameWithoutExtension);
	} catch {
		return nameWithoutExtension;
	}
}

/**
 * Validate M3U content format
 */
export function isValidM3U(content: string): boolean {
	const trimmed = content.trim();
	if (!trimmed) return false;
	
	// Check if it starts with M3U header or has at least one valid line
	const lines = trimmed.split('\n').map(line => line.trim()).filter(line => line.length > 0);
	
	// Must have at least one non-comment line (file path)
	const hasFilePath = lines.some(line => !line.startsWith('#'));
	
	return hasFilePath;
}