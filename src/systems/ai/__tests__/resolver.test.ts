import { observable } from "@legendapp/state";
import { resolveSuggestedTracks } from "@/systems/ai/resolver";
import { localMusicState$, type LocalTrack } from "@/systems/LocalMusicState";
import type { ProviderSearchProvider } from "@/providers/search/types";
import { getSearchProviders } from "@/providers/search/registry";

jest.mock("@/providers/search/registry", () => ({
    getSearchProviders: jest.fn(),
}));

const mockGetSearchProviders = getSearchProviders as jest.Mock;

const buildTrack = (overrides: Partial<LocalTrack> = {}): LocalTrack => ({
    id: "track-1",
    title: "Song A",
    artist: "Artist A",
    album: "Album A",
    duration: "3:00",
    filePath: "/music/song-a.mp3",
    fileName: "song-a.mp3",
    ...overrides,
});

const makeProvider = (searchImpl: ProviderSearchProvider["search"]): ProviderSearchProvider => ({
    id: "spotify",
    searchMode: "submit",
    search: searchImpl,
    isEnabled$: observable(true),
});

describe("resolveSuggestedTracks", () => {
    afterEach(() => {
        localMusicState$.tracks.set([]);
        mockGetSearchProviders.mockReset();
    });

    it("resolves local matches first", async () => {
        localMusicState$.tracks.set([buildTrack()]);
        mockGetSearchProviders.mockReturnValue([]);

        const result = await resolveSuggestedTracks([{ title: "Song A", artist: "Artist A" }]);

        expect(result.tracks).toHaveLength(1);
        expect(result.unresolved).toHaveLength(0);
    });

    it("uses provider search when local match is missing", async () => {
        const provider = makeProvider(async () => [
            {
                type: "track",
                item: buildTrack({
                    id: "remote-1",
                    title: "Song X",
                    artist: "Artist X",
                    filePath: "spotify:track:1",
                }),
            },
        ]);
        mockGetSearchProviders.mockReturnValue([provider]);

        const result = await resolveSuggestedTracks([{ title: "Song X", artist: "Artist X" }]);

        expect(provider.search).toHaveBeenCalledWith({ query: 'track:"Song X" artist:"Artist X"' });
        expect(result.tracks).toHaveLength(1);
        expect(result.unresolved).toHaveLength(0);
    });
});
