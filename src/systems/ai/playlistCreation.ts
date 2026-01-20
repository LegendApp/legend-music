import { observable } from "@legendapp/state";

export type AiPlaylistFillState = {
    playlistId: string | null;
    isGenerating: boolean;
    startedAt: number | null;
};

export const aiPlaylistFillState$ = observable<AiPlaylistFillState>({
    playlistId: null,
    isGenerating: false,
    startedAt: null,
});

export const startAiPlaylistFill = (playlistId: string): void => {
    aiPlaylistFillState$.set({
        playlistId,
        isGenerating: true,
        startedAt: Date.now(),
    });
};

export const finishAiPlaylistFill = (): void => {
    aiPlaylistFillState$.set({
        playlistId: null,
        isGenerating: false,
        startedAt: null,
    });
};
