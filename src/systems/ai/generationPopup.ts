import { observable } from "@legendapp/state";
import type { AiPromptSource } from "@/systems/ai/promptSource";
import type { LocalTrack } from "@/systems/LocalMusicState";
import type { SuggestionProviderId } from "@/systems/suggestions/types";

export type AiGenerationPopupAction = "generate-queue" | "start-mix" | "add-more-like-this" | "extend-playlist";

export type AiGenerationPopupAnchorRect = {
    screenX: number;
    screenY: number;
    width: number;
    height: number;
};

export type OpenAiGenerationPopupParams = {
    title: string;
    action: AiGenerationPopupAction;
    seedTracks?: LocalTrack[];
    targetPlaylistId?: string | null;
    windowId?: string | null;
    anchorRect?: AiGenerationPopupAnchorRect | null;
    initialProviderId?: SuggestionProviderId;
    initialPromptSource?: AiPromptSource;
};

export const aiGenerationPopup$ = observable({
    isOpen: false,
    title: "" as string,
    action: "generate-queue" as AiGenerationPopupAction,
    seedTracks: [] as LocalTrack[],
    targetPlaylistId: null as string | null,
    windowId: "main" as string,
    anchorRect: null as AiGenerationPopupAnchorRect | null,
    initialProviderId: null as SuggestionProviderId | null,
    initialPromptSource: null as AiPromptSource | null,
});

export function openAiGenerationPopup(params: OpenAiGenerationPopupParams): void {
    aiGenerationPopup$.assign({
        title: params.title,
        action: params.action,
        seedTracks: params.seedTracks ?? [],
        targetPlaylistId: params.targetPlaylistId ?? null,
        windowId: params.windowId ?? "main",
        anchorRect: params.anchorRect ?? null,
        initialProviderId: params.initialProviderId ?? null,
        initialPromptSource: params.initialPromptSource ?? null,
        isOpen: true,
    });
}

export function closeAiGenerationPopup(): void {
    aiGenerationPopup$.isOpen.set(false);
}
