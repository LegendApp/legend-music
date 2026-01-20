import { aiCommandRunner, type AIToolId } from "@/native-modules/AICommandRunner";
import { aiAvailability$ } from "@/systems/ai/availability";
import { buildPlaylistSummaryPrompt } from "@/systems/ai/prompts";
import { selectedSuggestionProvider$ } from "@/systems/suggestions/service";

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_SUMMARY_WORDS = 5;

const resolveSummaryTool = (): AIToolId => {
    const selectedProvider = selectedSuggestionProvider$.get();
    if (selectedProvider?.kind === "ai") {
        return selectedProvider.id;
    }

    const preferred = aiAvailability$.preferredTool.get();
    if (preferred) {
        return preferred;
    }

    if (aiAvailability$.claude.get()) {
        return "claude";
    }

    if (aiAvailability$.codex.get()) {
        return "codex";
    }

    throw new Error("No AI tool available for playlist summary.");
};

const buildInvocation = (tool: AIToolId, prompt: string): { command: string; args: string[] } => {
    if (tool === "codex") {
        return {
            command: "codex",
            args: [
                "exec",
                "--skip-git-repo-check",
                "--model",
                "gpt-5.2",
                "--config",
                "model_reasoning_effort=low",
                prompt,
            ],
        };
    }

    return { command: "claude", args: ["-p", prompt] };
};

const normalizeSummary = (raw: string): string => {
    const firstLine = raw.split("\n")[0]?.trim() ?? "";
    const stripped = firstLine.replace(/^["'`]+|["'`]+$/g, "").replace(/[.,!?;:]+/g, "");
    const words = stripped.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return "";
    }
    return words.slice(0, MAX_SUMMARY_WORDS).join(" ");
};

export async function generatePlaylistSummary(userPrompt: string): Promise<string> {
    const prompt = buildPlaylistSummaryPrompt(userPrompt);
    const tool = resolveSummaryTool();
    const invocation = buildInvocation(tool, prompt);

    const result = await aiCommandRunner.runCommand({
        command: invocation.command,
        args: invocation.args,
        timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    const output = result.stdout.trim() || result.stderr.trim();
    if (result.timedOut) {
        throw new Error("Summary generation timed out.");
    }
    if (result.exitCode !== 0) {
        throw new Error("Summary generation failed.");
    }

    const summary = normalizeSummary(output);
    if (!summary) {
        throw new Error("Summary generation returned empty output.");
    }

    return summary;
}
