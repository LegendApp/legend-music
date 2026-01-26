export type AiPromptSource = "streaming" | "local-library";

export const DEFAULT_AI_PROMPT_SOURCE: AiPromptSource = "streaming";

export const AI_PROMPT_SOURCE_OPTIONS = [
    { value: "streaming", label: "Streaming Service" },
    { value: "local-library", label: "Local Library" },
] as const satisfies ReadonlyArray<{ value: AiPromptSource; label: string }>;

export const coerceAiPromptSource = (value?: string | null): AiPromptSource =>
    value === "local-library" ? "local-library" : "streaming";
