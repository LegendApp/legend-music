import type { LocalTrack } from "@/systems/LocalMusicState";
import type { StreamingProviderId } from "@/providers/types";

export type AISuggestedTrack = {
    title: string;
    artist?: string;
    album?: string;
};

export type AIResolveResult = {
    tracks: LocalTrack[];
    unresolved: AISuggestedTrack[];
};

export type AISuggestionMode = "queue-extension" | "playlist";

export type AISuggestionRequest = {
    mode: AISuggestionMode;
    count?: number;
    prompt?: string;
    seedTracks?: LocalTrack[];
    preferredProviders?: StreamingProviderId[];
    timeoutMs?: number;
};

export type AISuggestionResponse = AIResolveResult & {
    rawResponse: string;
};
