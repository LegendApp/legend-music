import type { LocalTrack } from "@/systems/LocalMusicState";
import type { AISuggestedTrack } from "@/systems/ai/types";

export type SuggestionMode = "queue-extension" | "playlist";

export type SuggestionRequest = {
    mode: SuggestionMode;
    count?: number;
    prompt?: string;
    seedTracks?: LocalTrack[];
};

export type SuggestionResult = {
    providerId: SuggestionProviderId;
    tracks: LocalTrack[];
    unresolved?: AISuggestedTrack[];
    rawResponse?: string;
};

export type SuggestionProviderId = "claude" | "codex" | "spotify";

export type SuggestionProviderKind = "ai" | "spotify";

export type SuggestionProvider = {
    id: SuggestionProviderId;
    name: string;
    kind: SuggestionProviderKind;
    isAvailable: () => boolean;
    supportsModes: SuggestionMode[];
    suggest: (request: SuggestionRequest) => Promise<SuggestionResult>;
};
