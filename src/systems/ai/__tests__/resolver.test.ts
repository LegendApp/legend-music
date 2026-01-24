import { observable } from "@legendapp/state";
import { resolveSuggestedTracks } from "@/systems/ai/resolver";
import { localMusicState$, type LocalTrack } from "@/systems/LocalMusicState";
import type { StreamingProviderSearchProvider } from "@/providers/search/types";
import { LOCAL_LIBRARY_PROVIDER_ID } from "@/providers/localLibrary/constants";
import { enabledSearchProviderIds$, getSearchProviders } from "@/providers/search/registry";

jest.mock("@/providers/search/registry", () => ({
    getSearchProviders: jest.fn(),
    enabledSearchProviderIds$: jest.requireActual("@legendapp/state").observable<string[]>([]),
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

const makeProvider = (
    searchImpl: StreamingProviderSearchProvider["search"],
    id: StreamingProviderSearchProvider["id"] = "spotify",
): StreamingProviderSearchProvider => ({
    id,
    searchMode: "submit",
    search: jest.fn(searchImpl),
    isEnabled$: observable(true),
});

describe("resolveSuggestedTracks", () => {
    afterEach(() => {
        localMusicState$.tracks.set([]);
        mockGetSearchProviders.mockReset();
        enabledSearchProviderIds$.set([]);
    });

    it("resolves local matches first", async () => {
        localMusicState$.tracks.set([buildTrack()]);
        mockGetSearchProviders.mockReturnValue([]);
        enabledSearchProviderIds$.set([]);

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
        enabledSearchProviderIds$.set(["spotify"]);

        const result = await resolveSuggestedTracks([{ title: "Song X", artist: "Artist X" }]);

        expect(provider.search).toHaveBeenCalledWith({ query: 'track:"Song X" artist:"Artist X"' });
        expect(result.tracks).toHaveLength(1);
        expect(result.unresolved).toHaveLength(0);
    });

    it("restricts resolution to the local library provider when requested", async () => {
        const localProvider = makeProvider(
            async () => [
                {
                    type: "track",
                    item: buildTrack({
                        id: "local-1",
                        title: "Song L",
                        artist: "Artist L",
                    }),
                },
            ],
            LOCAL_LIBRARY_PROVIDER_ID,
        );
        const spotifyProvider = makeProvider(async () => [
            {
                type: "track",
                item: buildTrack({
                    id: "remote-1",
                    title: "Song L",
                    artist: "Artist L",
                    filePath: "spotify:track:1",
                }),
            },
        ]);
        mockGetSearchProviders.mockReturnValue([localProvider, spotifyProvider]);
        enabledSearchProviderIds$.set([LOCAL_LIBRARY_PROVIDER_ID, "spotify"]);

        const result = await resolveSuggestedTracks([{ title: "Song L", artist: "Artist L" }], {
            restrictToProviders: [LOCAL_LIBRARY_PROVIDER_ID],
        });

        expect(localProvider.search).toHaveBeenCalled();
        expect(spotifyProvider.search).not.toHaveBeenCalled();
        expect(result.tracks).toHaveLength(1);
        expect(result.unresolved).toHaveLength(0);
    });
});
