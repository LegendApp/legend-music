import type { ProviderId } from "@/providers/types";
import type { LibraryItem } from "@/systems/LibraryState";
import type { LocalPlaylist, LocalTrack } from "@/systems/LocalMusicState";

export type ProviderSearchMode = "immediate" | "submit";

export type SearchResult =
    | { type: "track"; item: LocalTrack }
    | { type: "library"; item: LibraryItem }
    | { type: "playlist"; item: LocalPlaylist };

export type ProviderSearchInput = {
    query: string;
    tracks?: LocalTrack[];
    playlists?: LocalPlaylist[];
    albums?: LibraryItem[];
    artists?: LibraryItem[];
};

export interface ProviderSearchProvider {
    id: ProviderId;
    searchMode: ProviderSearchMode;
    search: (input: ProviderSearchInput) => Promise<SearchResult[]> | SearchResult[];
}
