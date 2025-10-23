import type { LibraryItem, LibraryTrack } from "@/systems/LibraryState";
import { buildTrackItems } from "../useLibraryTrackList";

const mockTracks: LibraryTrack[] = [
    {
        id: "1",
        title: "Song A",
        artist: "Artist 1",
        album: "Album X",
        duration: "120",
        filePath: "/music/song-a.mp3",
        fileName: "song-a.mp3",
    },
    {
        id: "2",
        title: "Song B",
        artist: "Artist 2",
        album: "Album Y",
        duration: "3:45",
        filePath: "/music/song-b.mp3",
        fileName: "song-b.mp3",
    },
    {
        id: "3",
        title: "Another Song",
        artist: "Artist 1",
        album: "Album Z",
        duration: "200",
        filePath: "/music/song-c.mp3",
        fileName: "song-c.mp3",
    },
];

describe("buildTrackItems", () => {
    it("returns empty arrays when nothing is selected and no search query", () => {
        const result = buildTrackItems({
            tracks: mockTracks,
            selectedItem: null,
            searchQuery: "",
        });

        expect(result.sourceTracks).toHaveLength(0);
        expect(result.trackItems).toHaveLength(0);
    });

    it("filters tracks by selected artist", () => {
        const artistItem: LibraryItem = {
            id: "artist-1",
            type: "artist",
            name: "Artist 1",
        };

        const result = buildTrackItems({
            tracks: mockTracks,
            selectedItem: artistItem,
            searchQuery: "",
        });

        expect(result.sourceTracks.map((track) => track.id)).toEqual(["1", "3"]);
        expect(result.trackItems.map((track) => track.title)).toEqual(["Song A", "Another Song"]);
    });

    it("applies search query across title, artist, and album", () => {
        const result = buildTrackItems({
            tracks: mockTracks,
            selectedItem: null,
            searchQuery: "album y",
        });

        expect(result.sourceTracks.map((track) => track.id)).toEqual(["2"]);
        expect(result.trackItems[0]).toMatchObject({
            id: "2",
            title: "Song B",
            artist: "Artist 2",
            album: "Album Y",
        });
    });

    it("formats numeric durations into minutes and seconds", () => {
        const result = buildTrackItems({
            tracks: mockTracks,
            selectedItem: null,
            searchQuery: "Song A",
        });

        expect(result.trackItems[0].duration).toBe("2:00");
    });
});
