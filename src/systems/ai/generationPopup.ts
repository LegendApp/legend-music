import { observable } from "@legendapp/state";
import type { LocalTrack } from "@/systems/LocalMusicState";
import type { SuggestionProviderId } from "@/systems/suggestions/types";

export type AiGenerationPopupAction = "generate-queue" | "start-mix" | "add-more-like-this";

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
    anchorRect?: AiGenerationPopupAnchorRect | null;
    initialCount?: number;
    initialProviderId?: SuggestionProviderId;
};

export const aiGenerationPopup$ = observable({
    isOpen: false,
    title: "" as string,
    action: "generate-queue" as AiGenerationPopupAction,
    seedTracks: [] as LocalTrack[],
    anchorRect: null as AiGenerationPopupAnchorRect | null,
    initialCount: null as number | null,
    initialProviderId: null as SuggestionProviderId | null,
});

export function openAiGenerationPopup(params: OpenAiGenerationPopupParams): void {
    aiGenerationPopup$.assign({
        title: params.title,
        action: params.action,
        seedTracks: params.seedTracks ?? [],
        anchorRect: params.anchorRect ?? null,
        initialCount: typeof params.initialCount === "number" ? params.initialCount : null,
        initialProviderId: params.initialProviderId ?? null,
        isOpen: true,
    });
}

export function closeAiGenerationPopup(): void {
    aiGenerationPopup$.isOpen.set(false);
}

