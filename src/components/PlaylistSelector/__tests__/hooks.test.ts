import { generateM3UPlaylist } from "../hooks";

describe("generateM3UPlaylist", () => {
    it("builds a valid M3U playlist with formatted duration", () => {
        const playlist = generateM3UPlaylist([
            { title: "Song A", artist: "Artist 1", filePath: "/music/a.mp3", duration: "3:15" },
            { title: "Song B", artist: "Artist 2", filePath: "/music/b.mp3", duration: "120" },
        ]);

        expect(playlist).toContain("#EXTM3U");
        expect(playlist).toContain("#EXTINF:195,Artist 1 - Song A");
        expect(playlist).toContain("#EXTINF:120,Artist 2 - Song B");
        expect(playlist).toContain("/music/a.mp3");
        expect(playlist).toContain("/music/b.mp3");
    });

    it("defaults missing durations to -1", () => {
        const playlist = generateM3UPlaylist([{ title: "Song C", artist: "Artist 3", filePath: "/music/c.mp3" }]);

        expect(playlist).toContain("#EXTINF:-1,Artist 3 - Song C");
    });
});
