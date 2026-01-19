import type { LocalTrack } from "@/systems/LocalMusicState";

const buildJsonInstructions = (count: number): string => {
    return [
        "Return only JSON with this shape:",
        `{"tracks":[{"title":"...","artist":"...","album":"..."}]}`,
        `Include exactly ${count} tracks.`,
        "No markdown, no extra text."
    ].join("\n");
};

const formatSeedTracks = (tracks: LocalTrack[]): string => {
    return tracks
        .map((track, index) => {
            const album = track.album ? ` (${track.album})` : "";
            return `${index + 1}. ${track.title} - ${track.artist}${album}`;
        })
        .join("\n");
};

export const buildQueueExtensionPrompt = (seedTracks: LocalTrack[], count: number): string => {
    return [
        "You are a music assistant helping extend a playback queue.",
        "Based on the recent tracks below, suggest new tracks that fit the flow.",
        "Avoid repeating any of the seed tracks or near-duplicates.",
        "",
        "Recent tracks:",
        formatSeedTracks(seedTracks),
        "",
        buildJsonInstructions(count)
    ].join("\n");
};

export const buildPlaylistPrompt = (userPrompt: string, count: number): string => {
    return [
        "You are a music assistant creating a playlist.",
        `User prompt: ${userPrompt.trim()}`,
        "Suggest cohesive tracks that match the prompt.",
        "Avoid repeating the same artist too often.",
        "",
        buildJsonInstructions(count)
    ].join("\n");
};
