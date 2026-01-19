import { parseSuggestedTracks } from "@/systems/ai/parser";

describe("parseSuggestedTracks", () => {
    it("parses tracks from a tracks payload", () => {
        const input = JSON.stringify({
            tracks: [
                { title: "Song A", artist: "Artist A" },
                { name: "Song B", artist: "Artist B", album: "Album B" },
            ],
        });

        const result = parseSuggestedTracks(input, 10);
        expect(result).toEqual([
            { title: "Song A", artist: "Artist A" },
            { title: "Song B", artist: "Artist B", album: "Album B" },
        ]);
    });

    it("parses tracks from a fenced JSON block", () => {
        const input = [
            "Here you go:",
            "```json",
            JSON.stringify({ tracks: [{ title: "Song C", artist: "Artist C" }] }),
            "```",
        ].join("\n");

        const result = parseSuggestedTracks(input, 10);
        expect(result).toEqual([{ title: "Song C", artist: "Artist C" }]);
    });

    it("dedupes tracks with matching title and artist", () => {
        const input = JSON.stringify({
            tracks: [
                { title: "Song D", artist: "Artist D" },
                { title: "Song D", artist: "Artist D" },
                { title: "Song D", artist: "Artist D" },
            ],
        });

        const result = parseSuggestedTracks(input, 10);
        expect(result).toEqual([{ title: "Song D", artist: "Artist D" }]);
    });

    it("returns empty array for invalid input", () => {
        const result = parseSuggestedTracks("no json here", 10);
        expect(result).toEqual([]);
    });
});
