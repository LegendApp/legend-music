import { observable } from "@legendapp/state";

export type AiQueueFillState = {
    isGenerating: boolean;
    startedAt: number | null;
};

export const aiQueueFillState$ = observable<AiQueueFillState>({
    isGenerating: false,
    startedAt: null,
});

export const startAiQueueFill = (): void => {
    aiQueueFillState$.set({
        isGenerating: true,
        startedAt: Date.now(),
    });
};

export const finishAiQueueFill = (): void => {
    aiQueueFillState$.set({
        isGenerating: false,
        startedAt: null,
    });
};
