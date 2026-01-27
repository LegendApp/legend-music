import * as FileSystem from "expo-file-system/next";
import type { StreamingProviderId } from "@/providers/types";
import type { AiPromptSource } from "@/systems/ai/promptSource";
import type { SuggestionMode, SuggestionProviderId } from "@/systems/suggestions/types";
import { ensureCacheDirectory, getCacheDirectory } from "@/utils/cacheDirectories";

const AI_SEARCH_CACHE_DIR = "ai-search-cache";
const AI_SEARCH_CACHE_VERSION = 1;

export type AiSearchCacheFilters = {
    mode: SuggestionMode;
    promptSource: AiPromptSource;
    providerId: SuggestionProviderId;
    preferredTrackProviderId: StreamingProviderId | "auto" | null;
};

export type AiSearchCacheEntry = {
    version: number;
    createdAt: number;
    key: string;
    prompt: string;
    filters: AiSearchCacheFilters;
    trackIds: string[];
};

const buildCacheKey = (prompt: string, filters: AiSearchCacheFilters): string => {
    return JSON.stringify({
        version: AI_SEARCH_CACHE_VERSION,
        prompt: prompt.trim(),
        mode: filters.mode,
        promptSource: filters.promptSource,
        providerId: filters.providerId,
        preferredTrackProviderId: filters.preferredTrackProviderId ?? null,
    });
};

const hashString = (value: string): string => {
    let hash = 0;
    if (value.length === 0) {
        return hash.toString(16);
    }

    for (let i = 0; i < value.length; i++) {
        const char = value.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }

    return Math.abs(hash).toString(16);
};

const getCacheFile = (key: string): FileSystem.File => {
    const cacheDir = getCacheDirectory(AI_SEARCH_CACHE_DIR);
    const hash = hashString(key);
    return new FileSystem.File(cacheDir, `${hash}.json`);
};

export const readAiSearchCache = (prompt: string, filters: AiSearchCacheFilters): AiSearchCacheEntry | null => {
    const key = buildCacheKey(prompt, filters);
    const file = getCacheFile(key);
    if (!file.exists) {
        return null;
    }

    try {
        const raw = file.text();
        if (!raw.trim()) {
            return null;
        }

        const parsed = JSON.parse(raw) as AiSearchCacheEntry;
        if (!parsed || parsed.version !== AI_SEARCH_CACHE_VERSION || parsed.key !== key) {
            return null;
        }
        if (!Array.isArray(parsed.trackIds)) {
            return null;
        }

        return parsed;
    } catch (error) {
        console.warn("Failed to read AI search cache", error);
        return null;
    }
};

export const writeAiSearchCache = (prompt: string, filters: AiSearchCacheFilters, trackIds: string[]): void => {
    const key = buildCacheKey(prompt, filters);
    const cacheDir = getCacheDirectory(AI_SEARCH_CACHE_DIR);
    ensureCacheDirectory(cacheDir);

    const file = getCacheFile(key);
    const entry: AiSearchCacheEntry = {
        version: AI_SEARCH_CACHE_VERSION,
        createdAt: Date.now(),
        key,
        prompt: prompt.trim(),
        filters,
        trackIds,
    };

    try {
        file.write(JSON.stringify(entry));
    } catch (error) {
        console.warn("Failed to write AI search cache", error);
    }
};

export const clearAiSearchCache = (): void => {
    const cacheDir = getCacheDirectory(AI_SEARCH_CACHE_DIR);
    try {
        if (cacheDir.exists) {
            cacheDir.delete();
        }
    } catch (error) {
        console.warn("Failed to clear AI search cache", error);
    }
};
