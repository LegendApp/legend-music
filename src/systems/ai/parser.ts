import type { AISuggestedTrack } from "@/systems/ai/types";

export type AIScoredTrack = {
    id: string;
    score: number;
};

const normalizeText = (value: string): string =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ");

const extractJsonCandidate = (text: string): string | null => {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        return fenced[1].trim();
    }

    const trimmed = text.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return trimmed;
    }

    const firstBrace = trimmed.search(/[[{]/);
    if (firstBrace === -1) {
        return null;
    }

    const open = trimmed[firstBrace];
    const close = open === "{" ? "}" : "]";
    const lastBrace = trimmed.lastIndexOf(close);
    if (lastBrace <= firstBrace) {
        return null;
    }

    return trimmed.slice(firstBrace, lastBrace + 1);
};

const parseJson = (text: string): unknown | null => {
    const candidate = extractJsonCandidate(text);
    if (!candidate) {
        return null;
    }

    try {
        return JSON.parse(candidate);
    } catch (error) {
        console.warn("Failed to parse AI JSON response", error);
        return null;
    }
};

const coerceTrack = (entry: unknown): AISuggestedTrack | null => {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    const data = entry as Record<string, unknown>;
    const rawTitle = data.title ?? data.name ?? data.song ?? data.track;
    const rawArtist = data.artist ?? data.by ?? data.singer ?? data.band;
    const rawAlbum = data.album ?? data.release;

    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
    if (!title) {
        return null;
    }

    const artist = typeof rawArtist === "string" ? rawArtist.trim() : undefined;
    const album = typeof rawAlbum === "string" ? rawAlbum.trim() : undefined;

    return {
        title,
        artist: artist && artist.length > 0 ? artist : undefined,
        album: album && album.length > 0 ? album : undefined,
    };
};

const coerceScoreEntry = (entry: unknown): AIScoredTrack | null => {
    if (!entry || typeof entry !== "object") {
        return null;
    }

    const data = entry as Record<string, unknown>;
    const rawId = data.id ?? data.trackId ?? data.trackID;
    const rawScore = data.score ?? data.rank ?? data.rating;

    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!id) {
        return null;
    }

    const scoreValue =
        typeof rawScore === "number" ? rawScore : typeof rawScore === "string" ? Number(rawScore) : Number.NaN;
    if (!Number.isFinite(scoreValue)) {
        return null;
    }

    const score = Math.min(100, Math.max(0, Math.round(scoreValue)));

    return { id, score };
};

export const parseSuggestedTracks = (text: string, maxCount: number): AISuggestedTrack[] => {
    const parsed = parseJson(text);
    if (!parsed) {
        return [];
    }

    const entries = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" && parsed && Array.isArray((parsed as { tracks?: unknown }).tracks)
            ? (parsed as { tracks: unknown[] }).tracks
            : [];

    const seen = new Set<string>();
    const results: AISuggestedTrack[] = [];

    for (const entry of entries) {
        const track = coerceTrack(entry);
        if (!track) {
            continue;
        }

        const key = `${normalizeText(track.title)}::${normalizeText(track.artist ?? "")}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        results.push(track);

        if (results.length >= maxCount) {
            break;
        }
    }

    return results;
};

export const parseScoredTracks = (text: string): AIScoredTrack[] => {
    const parsed = parseJson(text);
    if (!parsed) {
        return [];
    }

    const entries = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" && parsed && Array.isArray((parsed as { tracks?: unknown }).tracks)
            ? (parsed as { tracks: unknown[] }).tracks
            : [];

    const results: AIScoredTrack[] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
        const scored = coerceScoreEntry(entry);
        if (!scored || seen.has(scored.id)) {
            continue;
        }

        seen.add(scored.id);
        results.push(scored);
    }

    return results;
};
