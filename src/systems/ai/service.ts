import { aiCommandRunner, getPreferredAITool, type AIToolId } from "@/native-modules/AICommandRunner";
import { buildPlaylistPrompt, buildQueueExtensionPrompt } from "@/systems/ai/prompts";
import { parseSuggestedTracks } from "@/systems/ai/parser";
import { resolveSuggestedTracks } from "@/systems/ai/resolver";
import type { AISuggestedTrack, AISuggestionRequest, AISuggestionResponse } from "@/systems/ai/types";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";

const DEFAULT_TRACK_COUNT = 10;
const DEFAULT_TIMEOUT_MS = 60000;

const toolCandidates: Record<AIToolId, Array<(prompt: string) => { args: string[]; input?: string }>> = {
    claude: [
        (prompt) => ({ args: ["-p", prompt] }),
        (prompt) => ({ args: ["--print", prompt] }),
        (prompt) => ({ args: ["--prompt", prompt] }),
        (prompt) => ({ args: [], input: prompt }),
    ],
    codex: [
        (prompt) => ({ args: ["-p", prompt] }),
        (prompt) => ({ args: ["--prompt", prompt] }),
        (prompt) => ({ args: ["--print", prompt] }),
        (prompt) => ({ args: [], input: prompt }),
    ],
};

const runToolPrompt = async (
    tool: AIToolId,
    prompt: string,
    count: number,
    timeoutMs: number,
): Promise<{ raw: string; suggestions: AISuggestedTrack[] }> => {
    const candidates = toolCandidates[tool] ?? [];
    let lastOutput = "";

    for (const buildInvocation of candidates) {
        const invocation = buildInvocation(prompt);
        const result = await aiCommandRunner.runCommand({
            command: tool,
            args: invocation.args,
            input: invocation.input,
            timeoutMs,
        });

        const output = result.stdout.trim() || result.stderr.trim();
        lastOutput = output;
        if (result.exitCode !== 0 || result.timedOut) {
            continue;
        }

        const suggestions = parseSuggestedTracks(output, count);
        if (suggestions.length > 0) {
            return { raw: output, suggestions };
        }
    }

    return { raw: lastOutput, suggestions: [] };
};

const buildPromptForRequest = (request: AISuggestionRequest): string => {
    const count = request.count ?? DEFAULT_TRACK_COUNT;

    if (request.mode === "queue-extension") {
        const seedTracks = request.seedTracks ?? [];
        return buildQueueExtensionPrompt(seedTracks, count);
    }

    const prompt = request.prompt?.trim();
    if (!prompt) {
        throw new Error("Missing AI playlist prompt.");
    }

    return buildPlaylistPrompt(prompt, count);
};

const buildProviderPreference = (seedTracks: LocalTrack[] | undefined): string[] => {
    if (!seedTracks || seedTracks.length === 0) {
        return [];
    }

    const counts = new Map<string, number>();
    for (const track of seedTracks) {
        if (!track.provider) {
            continue;
        }
        counts.set(track.provider, (counts.get(track.provider) ?? 0) + 1);
    }

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([provider]) => provider);
};

export const fetchAiSuggestions = async (request: AISuggestionRequest): Promise<AISuggestionResponse> => {
    const aiSettings = settings$.ai.get();
    if (!aiSettings.enabled) {
        throw new Error("AI features are disabled in settings.");
    }
    if (request.mode === "queue-extension" && !aiSettings.autoExtendQueue) {
        throw new Error("AI queue extension is disabled in settings.");
    }
    if (request.mode === "playlist" && !aiSettings.playlistCreation) {
        throw new Error("AI playlist creation is disabled in settings.");
    }

    const tool = await getPreferredAITool();
    if (!tool) {
        throw new Error("No supported AI CLI detected.");
    }

    const count = request.count ?? DEFAULT_TRACK_COUNT;
    const prompt = buildPromptForRequest({ ...request, count });
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const { raw, suggestions } = await runToolPrompt(tool, prompt, count, timeoutMs);

    if (suggestions.length === 0) {
        throw new Error("AI response did not include any tracks.");
    }

    const preferredProviders = request.preferredProviders ?? buildProviderPreference(request.seedTracks);
    const resolved = await resolveSuggestedTracks(suggestions, { preferredProviders });

    return {
        ...resolved,
        rawResponse: raw,
    };
};
