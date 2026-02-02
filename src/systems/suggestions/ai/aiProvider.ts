import { aiCommandRunner } from "@/native-modules/AICommandRunner";
import { LOCAL_LIBRARY_PROVIDER_ID } from "@/providers/localLibrary/constants";
import type { StreamingProviderId } from "@/providers/types";
import { aiAvailability$ } from "@/systems/ai/availability";
import { readMediaLibraryCsv } from "@/systems/ai/libraryCsv";
import { parseSuggestedTracks } from "@/systems/ai/parser";
import { type AiPromptSource, coerceAiPromptSource } from "@/systems/ai/promptSource";
import { buildPlaylistPrompt, buildQueueExtensionPrompt } from "@/systems/ai/prompts";
import { resolveSuggestedTracks } from "@/systems/ai/resolver";
import { readAiSearchCache, writeAiSearchCache } from "@/systems/ai/searchCache";
import type { AISuggestedTrack } from "@/systems/ai/types";
import { type LocalTrack, localMusicState$ } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import type { AiInvocation } from "@/systems/suggestions/ai/invocation";
import type {
    SuggestionProvider,
    SuggestionProviderId,
    SuggestionRequest,
    SuggestionResult,
} from "@/systems/suggestions/types";

const DEFAULT_TRACK_COUNT = 10;
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_ERROR_OUTPUT_LENGTH = 300;
const PLAYLIST_CACHE_TRACK_COUNT = 200;

export type AiProviderConfig = {
    id: SuggestionProviderId;
    name: string;
    buildInvocation: (prompt: string) => AiInvocation;
    parseResponse?: (raw: string, count: number) => AISuggestedTrack[];
};

const buildProviderPreference = (
    seedTracks: LocalTrack[] | undefined,
    preferredProviderId: StreamingProviderId | "auto" | null | undefined,
): StreamingProviderId[] => {
    const preferences: StreamingProviderId[] = [];
    if (preferredProviderId && preferredProviderId !== "auto") {
        preferences.push(preferredProviderId);
    }

    if (!seedTracks || seedTracks.length === 0) {
        return preferences;
    }

    const counts = new Map<StreamingProviderId, number>();
    for (const track of seedTracks) {
        if (!track.provider) {
            continue;
        }
        counts.set(track.provider, (counts.get(track.provider) ?? 0) + 1);
    }

    const fromSeeds = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([provider]) => provider);

    for (const provider of fromSeeds) {
        if (!preferences.includes(provider)) {
            preferences.push(provider);
        }
    }

    return preferences;
};

const buildPromptForRequest = (
    request: SuggestionRequest,
    count: number,
    options: { libraryCsv?: string } = {},
): string => {
    if (request.mode === "queue-extension") {
        const seedTracks = request.seedTracks ?? [];
        return buildQueueExtensionPrompt(seedTracks, count, { libraryCsv: options.libraryCsv });
    }

    const prompt = request.prompt?.trim();
    if (!prompt) {
        throw new Error("Missing playlist prompt.");
    }

    return buildPlaylistPrompt(prompt, count, { libraryCsv: options.libraryCsv });
};

const filterTracksByExcludeList = (tracks: LocalTrack[], excludeTrackIds?: string[]): LocalTrack[] => {
    if (!excludeTrackIds || excludeTrackIds.length === 0) {
        return tracks;
    }

    const exclude = new Set(excludeTrackIds);
    return tracks.filter((track) => !exclude.has(track.id));
};

const resolveCachedTracks = (trackIds: string[], count: number, excludeTrackIds?: string[]): LocalTrack[] => {
    const localTracks = localMusicState$.tracks.peek();
    const trackById = new Map(localTracks.map((track) => [track.id, track]));
    const exclude = new Set(excludeTrackIds ?? []);
    const results: LocalTrack[] = [];

    for (const trackId of trackIds) {
        if (exclude.has(trackId)) {
            continue;
        }

        const track = trackById.get(trackId);
        if (!track) {
            continue;
        }

        results.push(track);
        if (results.length >= count) {
            break;
        }
    }

    return results;
};

const dedupeTrackIds = (tracks: LocalTrack[]): string[] => {
    const seen = new Set<string>();
    const results: string[] = [];

    for (const track of tracks) {
        if (seen.has(track.id)) {
            continue;
        }
        seen.add(track.id);
        results.push(track.id);
    }

    return results;
};

const resolvePromptSource = (request: SuggestionRequest): AiPromptSource =>
    coerceAiPromptSource(request.promptSource ?? settings$.ai.promptSource.get());

const resolveAiAvailability = (id: SuggestionProviderId): boolean => {
    if (id === "claude") {
        return aiAvailability$.claude.get();
    }
    if (id === "codex") {
        return aiAvailability$.codex.get();
    }
    return false;
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

export const createAiSuggestionProvider = (config: AiProviderConfig): SuggestionProvider => {
    const isAvailable = () => resolveAiAvailability(config.id);
    const parse = config.parseResponse ?? parseSuggestedTracks;

    const suggest = async (request: SuggestionRequest): Promise<SuggestionResult> => {
        const count = request.count ?? DEFAULT_TRACK_COUNT;
        const promptSource = resolvePromptSource(request);
        const preferredProviderId = settings$.ai.preferredTrackProviderId.get();
        const trackProviderIdOverride = request.trackProviderIdOverride ?? null;
        const libraryCsv = promptSource === "local-library" ? readMediaLibraryCsv() : "";
        const shouldCache =
            request.mode === "playlist" && promptSource === "local-library" && Boolean(request.cachePrompt?.trim());
        const cachePrompt = shouldCache ? (request.cachePrompt?.trim() ?? "") : "";
        const cacheFilters = shouldCache
            ? {
                  mode: request.mode,
                  promptSource,
                  providerId: config.id,
                  preferredTrackProviderId: preferredProviderId ?? null,
              }
            : null;

        if (shouldCache && cacheFilters) {
            const cached = readAiSearchCache(cachePrompt, cacheFilters);
            if (cached) {
                const tracks = resolveCachedTracks(cached.trackIds, count, request.excludeTrackIds);
                return {
                    providerId: config.id,
                    tracks,
                };
            }
        }

        const targetCount = shouldCache ? Math.max(count, Math.min(PLAYLIST_CACHE_TRACK_COUNT, count * 10)) : count;
        const promptRequest = shouldCache && cachePrompt ? { ...request, prompt: cachePrompt } : request;
        const prompt = buildPromptForRequest(promptRequest, targetCount, { libraryCsv });
        const timeoutMs = DEFAULT_TIMEOUT_MS;

        const invocation = config.buildInvocation(prompt);
        const result = await aiCommandRunner.runCommand({
            command: invocation.command,
            args: invocation.args,
            input: invocation.input,
            timeoutMs,
        });

        const stdout = result.stdout.trim();
        const stderr = result.stderr.trim();
        const output = stdout || stderr;
        console.log("AI prompt output", { providerId: config.id, output });
        if (result.timedOut) {
            throw new Error(`${config.name} timed out after ${Math.round(timeoutMs / 1000)}s.`);
        }
        if (result.exitCode !== 0) {
            const detail = formatErrorOutput(stderr || stdout);
            const detailSuffix = detail ? ` Details: ${detail}` : "";
            throw new Error(`${config.name} failed to run (exit ${result.exitCode}).${detailSuffix}`);
        }

        const suggestions = parse(output, targetCount);
        if (suggestions.length === 0) {
            const detail = formatErrorOutput(output);
            const detailSuffix = detail ? ` Output: ${detail}` : "";
            throw new Error(`${config.name} response did not include any tracks.${detailSuffix}`);
        }

        const effectivePreferredProviderId =
            promptSource === "local-library"
                ? LOCAL_LIBRARY_PROVIDER_ID
                : trackProviderIdOverride
                  ? trackProviderIdOverride
                  : preferredProviderId === LOCAL_LIBRARY_PROVIDER_ID
                    ? null
                    : preferredProviderId;
        const preferredProviders =
            promptSource === "local-library"
                ? [LOCAL_LIBRARY_PROVIDER_ID]
                : trackProviderIdOverride
                  ? [trackProviderIdOverride]
                  : buildProviderPreference(request.seedTracks, effectivePreferredProviderId);
        const restrictToProviders =
            promptSource === "local-library"
                ? [LOCAL_LIBRARY_PROVIDER_ID]
                : trackProviderIdOverride
                  ? [trackProviderIdOverride]
                  : undefined;
        const resolved = await resolveSuggestedTracks(suggestions, { preferredProviders, restrictToProviders });
        if (shouldCache && cacheFilters && cachePrompt) {
            writeAiSearchCache(cachePrompt, cacheFilters, dedupeTrackIds(resolved.tracks));
        }

        const filteredTracks = filterTracksByExcludeList(resolved.tracks, request.excludeTrackIds);
        const returnedTracks = shouldCache ? filteredTracks.slice(0, count) : filteredTracks;

        return {
            providerId: config.id,
            rawResponse: output,
            tracks: returnedTracks,
            unresolved: resolved.unresolved,
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
