import { computed } from "@legendapp/state";
import { aiCommandRunner } from "@/native-modules/AICommandRunner";
import { LOCAL_LIBRARY_PROVIDER_ID } from "@/providers/localLibrary/constants";
import type {
    SearchResult,
    StreamingProviderSearchInput,
    StreamingProviderSearchProvider,
} from "@/providers/search/types";
import { aiAvailability$ } from "@/systems/ai/availability";
import { parseScoredTracks } from "@/systems/ai/parser";
import { buildLocalLibraryScorePrompt } from "@/systems/ai/prompts";
import { type LocalTrack, localMusicState$ } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";

const MAX_RESULTS = 10;
const SCORE_BATCH_SIZE = 500;
const MIN_SCORE = 30;
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_ERROR_OUTPUT_LENGTH = 300;

type AiTool = "claude" | "codex";

const resolveAiTool = (): AiTool | null => {
    const preferredProvider = settings$.ai.suggestionProviderId.get();
    if (preferredProvider === "claude" || preferredProvider === "codex") {
        return preferredProvider;
    }

    const preferredTool = aiAvailability$.preferredTool.get();
    if (preferredTool === "claude" || preferredTool === "codex") {
        return preferredTool;
    }

    if (aiAvailability$.claude.get()) {
        return "claude";
    }
    if (aiAvailability$.codex.get()) {
        return "codex";
    }

    return null;
};

const buildAiInvocation = (tool: AiTool, prompt: string): { command: string; args: string[]; input?: string } => {
    if (tool === "claude") {
        return { command: "claude", args: ["-p", prompt] };
    }

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
};

const chunkTracks = (tracks: LocalTrack[], size: number): LocalTrack[][] => {
    if (tracks.length === 0 || size <= 0) {
        return [];
    }

    const batches: LocalTrack[][] = [];
    for (let index = 0; index < tracks.length; index += size) {
        batches.push(tracks.slice(index, index + size));
    }

    return batches;
};

const formatErrorOutput = (output: string): string => {
    const trimmed = output.trim();
    if (!trimmed) {
        return "";
    }
    if (trimmed.length <= MAX_ERROR_OUTPUT_LENGTH) {
        return trimmed;
    }
    return `${trimmed.slice(0, MAX_ERROR_OUTPUT_LENGTH).trim()}...`;
};

const isEnabled$ = computed(() => {
    const aiSettings = settings$.ai.get();
    return aiSettings.enabled && Boolean(resolveAiTool());
});

export const localLibrarySearchProvider: StreamingProviderSearchProvider = {
    id: LOCAL_LIBRARY_PROVIDER_ID,
    searchMode: "submit",
    isEnabled$,
    search: async ({ query }: StreamingProviderSearchInput) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            return [];
        }

        const localTracks = localMusicState$.tracks.peek();
        if (localTracks.length === 0) {
            return [];
        }

        const tool = resolveAiTool();
        if (!tool) {
            return [];
        }

        const batches = chunkTracks(localTracks, SCORE_BATCH_SIZE);
        const trackById = new Map<string, LocalTrack>();
        const trackIndex = new Map<string, number>();
        for (const [index, track] of localTracks.entries()) {
            trackById.set(track.id, track);
            trackIndex.set(track.id, index);
        }

        const scores = new Map<string, number>();

        for (const [batchIndex, batch] of batches.entries()) {
            const prompt = buildLocalLibraryScorePrompt(trimmedQuery, batch);
            const invocation = buildAiInvocation(tool, prompt);
            const timeoutMs = DEFAULT_TIMEOUT_MS;

            const result = await aiCommandRunner.runCommand({
                command: invocation.command,
                args: invocation.args,
                input: invocation.input,
                timeoutMs,
            });

            const stdout = result.stdout.trim();
            const stderr = result.stderr.trim();
            const output = stdout || stderr;

            if (result.timedOut) {
                throw new Error(`${tool} timed out after ${Math.round(timeoutMs / 1000)}s.`);
            }

            if (result.exitCode !== 0) {
                const detail = formatErrorOutput(stderr || stdout);
                const detailSuffix = detail ? ` Details: ${detail}` : "";
                throw new Error(`${tool} failed to run (exit ${result.exitCode}).${detailSuffix}`);
            }

            const batchScores = parseScoredTracks(output);
            if (batchScores.length === 0) {
                console.warn("localLibrarySearch: Empty AI scoring response", { batch: batchIndex + 1 });
            }

            const scoredById = new Map<string, number>();
            for (const scored of batchScores) {
                scoredById.set(scored.id, scored.score);
            }

            let missingCount = 0;
            for (const track of batch) {
                const score = scoredById.get(track.id);
                if (score === undefined) {
                    missingCount += 1;
                    scores.set(track.id, 0);
                    continue;
                }

                scores.set(track.id, score);
            }

            if (missingCount > 0) {
                console.warn("localLibrarySearch: Missing AI scores for batch entries", {
                    batch: batchIndex + 1,
                    missing: missingCount,
                });
            }
        }

        const ranked = Array.from(scores.entries())
            .map(([id, score]) => {
                const track = trackById.get(id);
                if (!track) {
                    return null;
                }

                return {
                    track,
                    score,
                    index: trackIndex.get(id) ?? 0,
                };
            })
            .filter((entry): entry is { track: LocalTrack; score: number; index: number } => Boolean(entry))
            .filter((entry) => entry.score >= MIN_SCORE)
            .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
            .slice(0, MAX_RESULTS)
            .map((entry): SearchResult => ({ type: "track", item: entry.track }));

        return ranked;
    },
};
