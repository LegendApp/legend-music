import { aiCommandRunner } from "@/native-modules/AICommandRunner";
import { aiAvailability$ } from "@/systems/ai/availability";
import { parseSuggestedTracks } from "@/systems/ai/parser";
import { buildPlaylistPrompt, buildQueueExtensionPrompt } from "@/systems/ai/prompts";
import { resolveSuggestedTracks } from "@/systems/ai/resolver";
import type { AISuggestedTrack } from "@/systems/ai/types";
import type { SuggestionProvider, SuggestionProviderId, SuggestionRequest, SuggestionResult } from "@/systems/suggestions/types";
import type { LocalTrack } from "@/systems/LocalMusicState";

const DEFAULT_TRACK_COUNT = 10;
const DEFAULT_TIMEOUT_MS = 60000;

export type AiProviderConfig = {
    id: SuggestionProviderId;
    name: string;
    command: string;
    buildInvocation: (prompt: string) => { args: string[]; input?: string };
    parseResponse?: (raw: string, count: number) => AISuggestedTrack[];
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

const buildPromptForRequest = (request: SuggestionRequest, count: number): string => {
    if (request.mode === "queue-extension") {
        const seedTracks = request.seedTracks ?? [];
        return buildQueueExtensionPrompt(seedTracks, count);
    }

    const prompt = request.prompt?.trim();
    if (!prompt) {
        throw new Error("Missing playlist prompt.");
    }

    return buildPlaylistPrompt(prompt, count);
};

const resolveAiAvailability = (id: SuggestionProviderId): boolean => {
    if (id === "claude") {
        return aiAvailability$.claude.get();
    }
    if (id === "codex") {
        return aiAvailability$.codex.get();
    }
    return false;
};

export const createAiSuggestionProvider = (config: AiProviderConfig): SuggestionProvider => {
    const isAvailable = () => resolveAiAvailability(config.id);
    const parse = config.parseResponse ?? parseSuggestedTracks;

    const suggest = async (request: SuggestionRequest): Promise<SuggestionResult> => {
        const count = request.count ?? DEFAULT_TRACK_COUNT;
        const prompt = buildPromptForRequest(request, count);
        const timeoutMs = DEFAULT_TIMEOUT_MS;

        const invocation = config.buildInvocation(prompt);
        const result = await aiCommandRunner.runCommand({
            command: config.command,
            args: invocation.args,
            input: invocation.input,
            timeoutMs,
        });

        const output = result.stdout.trim() || result.stderr.trim();
        if (result.timedOut) {
            throw new Error(`${config.name} timed out.`);
        }
        if (result.exitCode !== 0) {
            throw new Error(`${config.name} failed to run.`);
        }

        const suggestions = parse(output, count);
        if (suggestions.length === 0) {
            throw new Error(`${config.name} response did not include any tracks.`);
        }

        const preferredProviders = buildProviderPreference(request.seedTracks);
        const resolved = await resolveSuggestedTracks(suggestions, { preferredProviders });

        return {
            providerId: config.id,
            rawResponse: output,
            ...resolved,
        };
    };

    return {
        id: config.id,
        name: config.name,
        kind: "ai",
        isAvailable,
        supportsModes: ["queue-extension", "playlist"],
        suggest,
    };
};
