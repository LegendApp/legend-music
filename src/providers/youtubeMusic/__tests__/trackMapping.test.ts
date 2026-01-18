import { getYoutubeMusicVideoId } from "@/providers/youtubeMusic/trackMapping";

describe("getYoutubeMusicVideoId", () => {
    it("parses ytm uris", () => {
        expect(getYoutubeMusicVideoId("ytm:abc123def45")).toBe("abc123def45");
    });

    it("parses YouTube Music urls", () => {
        expect(getYoutubeMusicVideoId("https://music.youtube.com/watch?v=abc123def45")).toBe("abc123def45");
        expect(getYoutubeMusicVideoId("music.youtube.com/watch?v=abc123def45")).toBe("abc123def45");
    });

    it("accepts raw video ids", () => {
        expect(getYoutubeMusicVideoId("abc123def45")).toBe("abc123def45");
    });

    it("ignores local file paths", () => {
        expect(getYoutubeMusicVideoId("/Users/jay/Music/track.mp3")).toBeNull();
        expect(getYoutubeMusicVideoId("file:///Users/jay/Music/track.mp3")).toBeNull();
    });

    it("ignores non-youtube urls", () => {
        expect(getYoutubeMusicVideoId("https://example.com/watch?v=abc123def45")).toBeNull();
    });
});
