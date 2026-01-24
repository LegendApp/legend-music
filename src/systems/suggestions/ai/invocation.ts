import type { AIToolId } from "@/native-modules/AICommandRunner";

export type AiInvocation = {
    command: string;
    args: string[];
    input?: string;
};

export const buildAiInvocation = (tool: AIToolId, prompt: string): AiInvocation => {
    if (tool === "codex") {
        return {
            command: "codex",
            args: [
                "exec",
                "--skip-git-repo-check",
                "--model",
                "gpt-5.2",
                "--config",
                "model_reasoning_effort=medium",
                prompt,
            ],
        };
    }

    return { command: "claude", args: ["-p", prompt] };
};
