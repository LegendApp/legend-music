import type { LibraryTrack } from "@/systems/LibraryState";
import type { LocalPlaylist } from "@/systems/LocalMusicState";
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
    it("songs view returns all tracks in order", () => {
        const result = buildTrackItems({
            tracks: mockTracks,
            playlists: [],
            selectedView: "songs",
            selectedPlaylistId: null,
            searchQuery: "",
        });

        expect(result.trackItems.map((track) => track.id)).toEqual(["1", "2", "3"]);
    });

    it("artists view inserts separators and groups by artist", () => {
        const result = buildTrackItems({
            tracks: mockTracks,
            playlists: [],
            selectedView: "artists",
            selectedPlaylistId: null,
            searchQuery: "",
        });

        expect(result.trackItems.map((item) => item.title)).toEqual([
            "— Artist 1 —",
            "Another Song",
            "Song A",
            "— Artist 2 —",
            "Song B",
        ]);
        expect(result.trackItems.filter((item) => item.isSeparator).length).toBe(2);
    });

    it("albums view inserts separators and groups by album", () => {
        const result = buildTrackItems({
            tracks: mockTracks,
            playlists: [],
            selectedView: "albums",
            selectedPlaylistId: null,
            searchQuery: "",
        });

        expect(result.trackItems.map((item) => item.title)).toEqual([
            "— Album X —",
            "Song A",
            "— Album Y —",
            "Song B",
            "— Album Z —",
            "Another Song",
        ]);
        expect(result.trackItems.filter((item) => item.isSeparator).length).toBe(3);
    });

    it("search filters globally and ignores view", () => {
        const result = buildTrackItems({
            tracks: mockTracks,
            playlists: [],
            selectedView: "artists",
            selectedPlaylistId: null,
            searchQuery: "album y",
        });

        expect(result.trackItems.map((track) => track.id)).toEqual(["2"]);
        expect(result.trackItems.some((item) => item.isSeparator)).toBe(false);
    });

    it("playlist view preserves order and flags missing tracks", () => {
        const playlists: LocalPlaylist[] = [
            {
                id: "/cache/data/test.m3u",
                name: "Test",
                filePath: "/cache/data/test.m3u",
                trackPaths: ["/music/song-b.mp3", "/music/missing.mp3", "/music/song-a.mp3"],
                trackCount: 3,
            },
        ];

        const result = buildTrackItems({
            tracks: mockTracks,
            playlists,
            selectedView: "playlist",
            selectedPlaylistId: playlists[0].id,
            searchQuery: "",
        });

        expect(result.trackItems.map((item) => item.id)).toEqual(["2", "/music/missing.mp3", "1"]);
        expect(result.trackItems[1]).toMatchObject({ isMissing: true, title: "missing.mp3" });
    });

    it("formats numeric durations into minutes and seconds", () => {
        const result = buildTrackItems({
            tracks: mockTracks,
            playlists: [],
            selectedView: "songs",
            selectedPlaylistId: null,
            searchQuery: "",
        });

        const songA = result.trackItems.find((track) => track.id === "1");
        expect(songA?.duration).toBe("2:00");
    });
});
