import type { StreamingProviderId } from "@/providers/types";
import type { AiPromptSource } from "@/systems/ai/promptSource";
import type { AISuggestedTrack } from "@/systems/ai/types";
import type { LocalTrack } from "@/systems/LocalMusicState";

export type SuggestionMode = "queue-extension" | "playlist";

export type SuggestionRequest = {
    providerIdOverride?: SuggestionProviderId;
    trackProviderIdOverride?: StreamingProviderId | null;
    mode: SuggestionMode;
    source?: "auto" | "manual";
    promptSource?: AiPromptSource;
    count?: number;
    prompt?: string;
    seedTracks?: LocalTrack[];
    cachePrompt?: string;
    excludeTrackIds?: string[];
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
