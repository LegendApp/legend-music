import { parseSuggestedTracks } from "@/systems/ai/parser";
import type { AISuggestedTrack } from "@/systems/ai/types";
import { createAiSuggestionProvider } from "@/systems/suggestions/ai/aiProvider";

const parseCodexLines = (raw: string, maxCount: number): AISuggestedTrack[] => {
    const lines = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const results: AISuggestedTrack[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
        const cleaned = line.replace(/^\d+\.?\s+/, "").replace(/^[*-]\s+/, "");
        let title = "";
        let artist = "";
        let album: string | undefined;

        const byMatch = cleaned.match(/^(.*?)\s+by\s+(.*)$/i);
        if (byMatch) {
            title = byMatch[1].trim();
            artist = byMatch[2].trim();
        } else if (cleaned.includes(" - ")) {
            const parts = cleaned.split(" - ");
            title = parts[0]?.trim() ?? "";
            artist = parts.slice(1).join(" - ").trim();
        }

        if (!title) {
            continue;
        }

        if (artist.includes("(") && artist.includes(")")) {
            const match = artist.match(/^(.*?)\s*\((.*?)\)\s*$/);
            if (match) {
                artist = match[1].trim();
                album = match[2].trim();
            }
        }

        const key = `${title.toLowerCase()}::${artist.toLowerCase()}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        results.push({
            title,
            artist: artist || undefined,
            album: album || undefined,
        });

        if (results.length >= maxCount) {
            break;
        }
    }

    return results;
};

const parseCodexResponse = (raw: string, count: number): AISuggestedTrack[] => {
    const parsed = parseSuggestedTracks(raw, count);
    if (parsed.length > 0) {
        return parsed;
    }

    return parseCodexLines(raw, count);
};

export const codexSuggestionProvider = createAiSuggestionProvider({
    id: "codex",
    name: "Codex",
    command: "codex",
    buildInvocation: (prompt) => ({ args: ["exec", "--skip-git-repo-check", prompt] }),
    parseResponse: parseCodexResponse,
});
