export interface M3UTrack {
    duration: number; // Duration in seconds, -1 for unknown
    title: string;
    artist?: string;
    filePath: string;
    logo?: string; // URL to track thumbnail/logo
    addedAt?: number;
    id: string; // Video ID extracted from URL
}

export interface M3UPlaylist {
    songs: M3UTrack[];
    suggestions: M3UTrack[];
}

/**
 * Parse M3U playlist content into a typed JavaScript object
 */
export function parseM3U(content: string): M3UPlaylist {
    const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const songs: M3UTrack[] = [];
    const suggestions: M3UTrack[] = [];
    let currentSection: "songs" | "suggestions" = "songs"; // Default to songs section

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Check for EXTGRP marker to switch to suggestions section
        if (line.startsWith("#EXTGRP:")) {
            currentSection = "suggestions";
            i++;
            continue;
        }

        // Skip other comments that aren't EXTINF
        if (line.startsWith("#") && !line.startsWith("#EXTINF:")) {
            i++;
            continue;
        }

        // Parse EXTINF line
        if (line.startsWith("#EXTINF:")) {
            const extinfBody = line.slice("#EXTINF:".length);
            const commaIndex = extinfBody.indexOf(",");
            if (commaIndex !== -1 && i + 1 < lines.length) {
                const header = extinfBody.slice(0, commaIndex).trim();
                const titleInfo = extinfBody.slice(commaIndex + 1).trim();
                const headerParts = header.split(" ").filter(Boolean);
                const durationText = headerParts.shift() ?? "-1";
                const durationValue = Number.parseInt(durationText, 10);
                const duration = Number.isNaN(durationValue) ? -1 : durationValue;
                const attributes = headerParts.join(" ");
                const filePath = lines[i + 1];

                let logo: string | undefined;
                let addedAt: number | undefined;
                if (attributes) {
                    const attrRegex = /(\w+)="([^"]*)"/g;
                    let match: RegExpExecArray | null;
                    while ((match = attrRegex.exec(attributes)) !== null) {
                        const key = match[1];
                        const value = match[2];
                        if (key === "logo") {
                            logo = value;
                        } else if (key === "added") {
                            const parsed = Number.parseInt(value, 10);
                            if (Number.isFinite(parsed)) {
                                addedAt = parsed;
                            }
                        }
                    }
                }

                // Parse artist and title from the title info
                let title = titleInfo;
                let artist: string | undefined;

                // Check for "Artist - Title" format
                if (titleInfo.includes(" - ")) {
                    const parts = titleInfo.split(" - ");
                    artist = parts[0].trim();
                    title = parts.slice(1).join(" - ").trim();
                }

                const track = {
                    id: filePath, // Use file path as ID for local files
                    duration,
                    title,
                    artist,
                    filePath,
                    logo, // Include logo if present
                    addedAt,
                };

                // Add to appropriate section
                if (currentSection === "suggestions") {
                    suggestions.push(track);
                } else {
                    songs.push(track);
                }

                i += 2; // Skip the file path line
            } else {
                i++;
            }
        } else {
            // Plain file path without EXTINF
            const track = {
                id: line, // Use file path as ID for local files
                duration: -1,
                title: extractTitleFromPath(line),
                filePath: line,
            };

            // Add to appropriate section
            if (currentSection === "suggestions") {
                suggestions.push(track);
            } else {
                songs.push(track);
            }
            i++;
        }
    }

    return { songs, suggestions };
}

/**
 * Convert a typed JavaScript object to M3U playlist content
 */
export function writeM3U(playlist: M3UPlaylist): string {
    const lines: string[] = ["#EXTM3U"];

    // Write songs section
    for (const track of playlist.songs) {
        // Create the title info
        let titleInfo = track.title;
        if (track.artist) {
            titleInfo = `${track.artist} - ${track.title}`;
        }

        // Add EXTINF line with optional attributes
        const attributes: string[] = [];
        if (track.logo) {
            attributes.push(`logo="${track.logo}"`);
        }
        if (typeof track.addedAt === "number" && Number.isFinite(track.addedAt)) {
            attributes.push(`added="${track.addedAt}"`);
        }
        let extinfLine = `#EXTINF:${track.duration}`;
        if (attributes.length > 0) {
            extinfLine += ` ${attributes.join(" ")}`;
        }
        extinfLine += `,${titleInfo}`;
        lines.push(extinfLine);

        // Add file path
        lines.push(track.filePath);
        lines.push("");
    }

    // Write suggestions section if there are any
    if (playlist.suggestions.length > 0) {
        // Add EXTGRP marker for suggestions
        lines.push("#EXTGRP:suggestions");
        lines.push("");

        for (const track of playlist.suggestions) {
            // Create the title info
            let titleInfo = track.title;
            if (track.artist) {
                titleInfo = `${track.artist} - ${track.title}`;
            }

            // Add EXTINF line with optional attributes
            const attributes: string[] = [];
            if (track.logo) {
                attributes.push(`logo="${track.logo}"`);
            }
            if (typeof track.addedAt === "number" && Number.isFinite(track.addedAt)) {
                attributes.push(`added="${track.addedAt}"`);
            }
            let extinfLine = `#EXTINF:${track.duration}`;
            if (attributes.length > 0) {
                extinfLine += ` ${attributes.join(" ")}`;
            }
            extinfLine += `,${titleInfo}`;
            lines.push(extinfLine);

            // Add file path
            lines.push(track.filePath);
            lines.push("");
        }
    }

    return `${lines.join("\n")}\n`;
}

/**
 * Extract a title from a file path
 */
function extractTitleFromPath(filePath: string): string {
    // Get the filename without path
    const filename = filePath.split("/").pop() || filePath;

    // Remove extension
    const nameWithoutExtension = filename.replace(/\.[^.]*$/, "");

    // Decode URL-encoded characters
    try {
        return decodeURIComponent(nameWithoutExtension);
    } catch {
        return nameWithoutExtension;
    }
}


/**
 * Parse duration from "MM:SS" format to seconds
 * @param duration Duration string in "MM:SS" format (e.g., "3:45")
 * @returns Duration in seconds, or -1 if parsing fails
 */
export function parseDurationToSeconds(duration: string): number {
    if (!duration || typeof duration !== "string") {
        return -1;
    }

    // Handle formats like "3:45", "0:30", "12:34"
    const match = duration.match(/^(\d+):(\d{2})$/);
    if (!match) {
        return -1;
    }

    const minutes = Number.parseInt(match[1], 10);
    const seconds = Number.parseInt(match[2], 10);

    if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds >= 60) {
        return -1;
    }

    return minutes * 60 + seconds;
}

/**
 * Format duration from seconds to "MM:SS" format
 * @param seconds Duration in seconds
 * @returns Duration string in "MM:SS" format, or "0:00" if invalid
 */
export function formatSecondsToMmSs(seconds: number): string {
    if (typeof seconds !== "number" || seconds < 0 || !Number.isFinite(seconds)) {
        return "0:00";
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}
