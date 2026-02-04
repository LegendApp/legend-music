export type AiPromptSource = "streaming" | "local-library";

export const DEFAULT_AI_PROMPT_SOURCE: AiPromptSource = "streaming";

export const AI_PROMPT_SOURCE_OPTIONS = [
    { value: "streaming", label: "Streaming Service" },
    { value: "local-library", label: "Local Library" },
] as const satisfies ReadonlyArray<{ value: AiPromptSource; label: string }>;

export const coerceAiPromptSource = (value?: string | null): AiPromptSource =>
    value === "local-library" ? "local-library" : "streaming";

export const isAiPromptSource = (value?: string | null): value is AiPromptSource =>
    value === "streaming" || value === "local-library";

export type AiPromptContext = "queue" | "playlist" | "editor";

export const getAiPromptPlaceholder = (source: AiPromptSource, context: AiPromptContext): string => {
    const isLocal = source === "local-library";

    if (context === "queue") {
        return "Describe the queue";
    }

    if (context === "editor") {
        return "Describe the playlist";
    }

    return "Describe the tracks to add";
};
