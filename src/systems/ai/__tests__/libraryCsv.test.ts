import { buildMediaLibraryCsv } from "@/systems/ai/libraryCsv";
import type { LibrarySnapshot } from "@/systems/LibraryCache";

const makeSnapshot = (overrides: Partial<LibrarySnapshot> = {}): LibrarySnapshot => ({
    version: 1,
    updatedAt: 0,
    tracks: [],
    lastScanTime: null,
    roots: [],
    ...overrides,
});

describe("buildMediaLibraryCsv", () => {
    it("writes headers and escapes fields", () => {
        const snapshot = makeSnapshot({
            tracks: [
                {
                    root: 0,
                    rel: "song.mp3",
                    title: 'Song "A"',
                    artist: "Artist, One",
                    album: "Best\nHits",
                    duration: "3:00",
                },
            ],
        });

        const csv = buildMediaLibraryCsv(snapshot);

        expect(csv).toBe(
            ["artist,title,album,year,genre", '"Artist, One","Song ""A""",Best Hits,,'].join("\n"),
        );
    });
});
