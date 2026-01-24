import { computed } from "@legendapp/state";
import { aiCommandRunner } from "@/native-modules/AICommandRunner";
import { readMediaLibraryCsv } from "@/systems/ai/libraryCsv";
import { buildLocalLibrarySearchPrompt } from "@/systems/ai/prompts";
import { parseSuggestedTracks } from "@/systems/ai/parser";
import type { AISuggestedTrack } from "@/systems/ai/types";
import { aiAvailability$ } from "@/systems/ai/availability";
import { normalizeArtistName } from "@/systems/LibraryState";
import { localMusicState$, type LocalTrack } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import type {
    StreamingProviderSearchInput,
    StreamingProviderSearchProvider,
    SearchResult,
} from "@/providers/search/types";
import { LOCAL_LIBRARY_PROVIDER_ID } from "@/providers/localLibrary/constants";

const MAX_RESULTS = 10;
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
        args: ["exec", "--skip-git-repo-check", "--model", "gpt-5.2", "--config", "model_reasoning_effort=low", prompt],
    };
};

const normalizeToken = (value: string): string =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ");

const buildLocalIndexes = (tracks: LocalTrack[]) => {
    const byTitleArtist = new Map<string, LocalTrack[]>();
    const byTitle = new Map<string, LocalTrack[]>();

    for (const track of tracks) {
        const titleKey = normalizeToken(track.title);
        const artistKey = normalizeToken(normalizeArtistName(track.artist));

        if (titleKey) {
            const titleMatches = byTitle.get(titleKey) ?? [];
            titleMatches.push(track);
            byTitle.set(titleKey, titleMatches);
        }

        if (titleKey && artistKey) {
            const compositeKey = `${titleKey}::${artistKey}`;
            const matches = byTitleArtist.get(compositeKey) ?? [];
            matches.push(track);
            byTitleArtist.set(compositeKey, matches);
        }
    }

    return { byTitleArtist, byTitle };
};

const resolveLocalMatch = (
    suggestion: AISuggestedTrack,
    indexes: ReturnType<typeof buildLocalIndexes>,
): LocalTrack | null => {
    const titleKey = normalizeToken(suggestion.title);
    const artistKey = normalizeToken(suggestion.artist ? normalizeArtistName(suggestion.artist) : "");

    if (titleKey && artistKey) {
        const matches = indexes.byTitleArtist.get(`${titleKey}::${artistKey}`);
        if (matches && matches.length > 0) {
            return matches[0];
        }
    }

    if (titleKey) {
        const matches = indexes.byTitle.get(titleKey);
        if (matches && matches.length > 0) {
            return matches[0];
        }
    }

    return null;
};

const buildResultsFromSuggestions = (suggestions: AISuggestedTrack[], tracks: LocalTrack[]): SearchResult[] => {
    const indexes = buildLocalIndexes(tracks);
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    for (const suggestion of suggestions) {
        const match = resolveLocalMatch(suggestion, indexes);
        if (!match || seen.has(match.id)) {
            continue;
        }

        results.push({ type: "track", item: match });
        seen.add(match.id);

        if (results.length >= MAX_RESULTS) {
            break;
        }
    }

    return results;
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

        const csv = readMediaLibraryCsv();
        if (!csv.trim()) {
            return [];
        }

        const tool = resolveAiTool();
        if (!tool) {
            return [];
        }

        const prompt = buildLocalLibrarySearchPrompt(trimmedQuery, csv, MAX_RESULTS);
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

        const suggestions = parseSuggestedTracks(output, MAX_RESULTS);
        if (suggestions.length === 0) {
            return [];
        }

        const localTracks = localMusicState$.tracks.peek();
        return buildResultsFromSuggestions(suggestions, localTracks);
    },
};
