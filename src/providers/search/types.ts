import type { Observable } from "@legendapp/state";
import type { StreamingProviderId } from "@/providers/types";
import type { LibraryItem } from "@/systems/LibraryState";
import type { LocalPlaylist, LocalTrack } from "@/systems/LocalMusicState";

export type StreamingProviderSearchMode = "immediate" | "submit";

export type SearchResult =
    | { type: "track"; item: LocalTrack }
    | { type: "library"; item: LibraryItem }
    | { type: "playlist"; item: LocalPlaylist };

export type StreamingProviderSearchInput = {
    query: string;
    tracks?: LocalTrack[];
    playlists?: LocalPlaylist[];
    albums?: LibraryItem[];
    artists?: LibraryItem[];
};

export interface StreamingProviderSearchProvider {
    id: StreamingProviderId;
    searchMode: StreamingProviderSearchMode;
    search: (input: StreamingProviderSearchInput) => Promise<SearchResult[]> | SearchResult[];
    isEnabled$?: Observable<boolean>;
}
