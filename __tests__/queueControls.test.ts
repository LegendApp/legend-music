import { audioControls, audioPlayerState$, queue$ } from "../src/components/AudioPlayer";
import type { LocalTrack } from "../src/systems/LocalMusicState";

function createQueuedTrack(id: string, overrides: Partial<LocalTrack> = {}) {
    return {
        id,
        filePath: `/music/${id}.mp3`,
        fileName: `${id}.mp3`,
        title: `Track ${id}`,
        artist: "Test Artist",
        duration: "1:00",
        queueEntryId: `queue-${id}`,
        ...overrides,
    };
}

function createTrack(id: string, overrides: Partial<LocalTrack> = {}): LocalTrack {
    return {
        id,
        filePath: `/music/${id}.mp3`,
        fileName: `${id}.mp3`,
        title: `Track ${id}`,
        artist: "Test Artist",
        duration: "1:00",
        ...overrides,
    };
}

describe("queueControls.insertAt", () => {
    beforeEach(() => {
        queue$.tracks.set([
            createQueuedTrack("a"),
            createQueuedTrack("b"),
            createQueuedTrack("c"),
        ]);
        audioPlayerState$.currentIndex.set(1);
        audioPlayerState$.currentTrack.set(createTrack("b"));
    });

    afterEach(() => {
        queue$.tracks.set([]);
        audioPlayerState$.currentIndex.set(-1);
        audioPlayerState$.currentTrack.set(null);
    });

    it("inserts tracks at the requested position", () => {
        const newTrack = createTrack("mid");

        audioControls.queue.insertAt(1, newTrack);

        const tracks = queue$.tracks.get();
        expect(tracks).toHaveLength(4);
        expect(tracks[1]?.id).toBe("mid");
    });

    it("shifts the current index forward when inserting before the playing track", () => {
        const newTrack = createTrack("before-current");

        audioControls.queue.insertAt(1, newTrack);

        expect(audioPlayerState$.currentIndex.get()).toBe(2);
    });

    it("keeps the current index when inserting after the playing track", () => {
        const newTrack = createTrack("after-current");

        audioControls.queue.insertAt(3, newTrack);

        expect(audioPlayerState$.currentIndex.get()).toBe(1);
    });
});
