import * as id3Writer from "@/utils/id3Writer";

const mockWriteMediaTags = jest.fn();

jest.mock("@/native-modules/AudioPlayer", () => ({
    __esModule: true,
    default: {
        writeMediaTags: mockWriteMediaTags,
    },
}));

describe("id3Writer helper", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
        // Ensure the default export has our mock writer available
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any
        const audioPlayer: any = require("@/native-modules/AudioPlayer").default;
        audioPlayer.writeMediaTags = mockWriteMediaTags;
    });

    it("guards when native writer is unavailable", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        const result = await id3Writer.writeNativeID3Tags("/tmp/song.mp3", {}, () => false);

        expect(id3Writer.isNativeID3WriterAvailable()).toBe(false);
        expect(result).toEqual({ success: false });
        expect(mockWriteMediaTags).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it("delegates to the native writer on macOS", async () => {
        const availabilityCheck = jest.fn(() => true);
        mockWriteMediaTags.mockResolvedValue({ success: true });

        const result = await id3Writer.writeNativeID3Tags("/tmp/song.mp3", { title: "Track" }, availabilityCheck);

        expect(availabilityCheck).toHaveBeenCalled();
        expect(mockWriteMediaTags).toHaveBeenCalledWith("/tmp/song.mp3", { title: "Track" });
        expect(result).toEqual({ success: true });
    });
});
