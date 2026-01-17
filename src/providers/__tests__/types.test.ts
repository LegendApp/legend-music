import { getPlaybackProviderForTrack, registerPlaybackProvider } from "@/providers/types";
import type { PlaybackProvider } from "@/providers/types";
import type { LocalTrack } from "@/systems/LocalMusicState";

describe("playback provider routing", () => {
    it("selects provider by track source", () => {
        const providerId = "test-playback-provider";
        const playbackProvider: PlaybackProvider = {
            id: providerId,
            canHandle: (track) => track.provider === providerId,
            async load() {
                return;
            },
            async play() {
                return;
            },
            async pause() {
                return;
            },
            async seek() {
                return;
            },
            async setVolume() {
                return;
            },
            getDurationSeconds() {
                return 0;
            },
        };

        registerPlaybackProvider(playbackProvider);

        const track = {
            id: "track-1",
            title: "Test Track",
            artist: "Test",
            duration: "0",
            filePath: "test://track-1",
            fileName: "track-1",
            provider: providerId,
        } as LocalTrack;

        expect(getPlaybackProviderForTrack(track)?.id).toBe(providerId);
    });
});
