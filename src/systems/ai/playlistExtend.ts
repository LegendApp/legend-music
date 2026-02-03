import type { StreamingProviderId } from "@/providers/types";
import { buildPlaylistEntries } from "@/systems/ai/playlistTracks";
import type { AiPromptSource } from "@/systems/ai/promptSource";
import { generatePlaylistSummary } from "@/systems/ai/summary";
import type { AISuggestedTrack } from "@/systems/ai/types";
import type { LocalPlaylist } from "@/systems/LocalMusicState";
import { addTracksToPlaylist, updatePlaylistMetadata } from "@/systems/LocalPlaylists";
import { fetchSuggestions } from "@/systems/suggestions";
import type { SuggestionProviderId } from "@/systems/suggestions/types";

const buildPlaylistExtendPrompt = (prompt: string, playlist: LocalPlaylist | null): string => {
    if (!playlist) {
        return prompt;
    }

    const lines: string[] = [];
    const seen = new Set<string>();
    const addLine = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) {
            return;
        }
        const key = trimmed.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        lines.push(trimmed);
    };

    const trackEntries = playlist.tracks ?? [];
    if (trackEntries.length > 0) {
        for (const track of trackEntries) {
            const title = track.title?.trim() || track.filePath.split("/").pop() || track.filePath;
            const artist = track.artist?.trim();
            addLine(artist ? `${artist} - ${title}` : title);
        }
    } else if (playlist.trackPaths.length > 0) {
        for (const path of playlist.trackPaths) {
            const title = path.split("/").pop() || path;
            addLine(title);
        }
    }

    if (lines.length === 0) {
        return prompt;
    }

    const avoidLine = "Avoid suggesting any of these tracks already in the playlist:";
    const instructionLine = "Only suggest new, non-duplicate tracks.";
    return `${prompt}\n\n${avoidLine}\n${lines.join("\n")}\n\n${instructionLine}`;
};

type ExtendLocalPlaylistOptions = {
    promptSource: AiPromptSource;
    count: number;
    providerIdOverride?: SuggestionProviderId;
    trackProviderIdOverride?: StreamingProviderId | null;
    updateMetadata?: boolean;
};

export type ExtendLocalPlaylistResult = {
    addedPaths: string[];
    playlist: LocalPlaylist;
    unresolved?: AISuggestedTrack[];
};

export async function extendLocalPlaylistWithPrompt(
    playlist: LocalPlaylist,
    promptValue: string,
    options: ExtendLocalPlaylistOptions,
): Promise<ExtendLocalPlaylistResult> {
    const trimmedPrompt = promptValue.trim();
    if (!trimmedPrompt) {
        throw new Error("Prompt cannot be empty.");
    }

    const promptWithContext = buildPlaylistExtendPrompt(trimmedPrompt, playlist);
    const summaryPromise = options.updateMetadata
        ? generatePlaylistSummary(trimmedPrompt).catch((error) => {
              console.warn("AI playlist summary failed", error);
              return null;
          })
        : Promise.resolve(null);

    const { tracks: suggestedTracks, unresolved } = await fetchSuggestions({
        mode: "playlist",
        prompt: promptWithContext,
        count: options.count,
        promptSource: options.promptSource,
        cachePrompt: trimmedPrompt,
        providerIdOverride: options.providerIdOverride,
        trackProviderIdOverride: options.trackProviderIdOverride,
        excludeTrackIds: playlist.trackPaths,
    });

    if (suggestedTracks.length === 0) {
        throw new Error("No tracks were suggested.");
    }

    const { trackEntries, trackPaths } = buildPlaylistEntries(suggestedTracks);
    if (trackPaths.length === 0) {
        throw new Error("No resolved tracks to add.");
    }

    const { addedPaths, playlist: updatedPlaylist } = await addTracksToPlaylist(playlist.id, trackPaths, {
        trackEntries,
    });

    if (options.updateMetadata) {
        const summary = await summaryPromise;
        try {
            updatePlaylistMetadata(playlist.id, {
                aiPrompt: trimmedPrompt,
                aiSummary: summary ?? playlist.aiSummary,
                aiSource: options.promptSource,
            });
        } catch (error) {
            console.warn("Failed to update AI playlist metadata", error);
        }
    }

    return { addedPaths, playlist: updatedPlaylist, unresolved };
}
