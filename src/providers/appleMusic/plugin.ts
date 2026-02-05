import type { StreamingProviderPlugin } from "@/providers/pluginRegistry";
import { AppleMusicSourceBadge } from "@/components/AppleMusicSourceBadge";
import { isAppleMusicAuthorized$ } from "@/providers/appleMusic/authState";
import { isStreamingProviderEnabled } from "@/providers/streamingProviderRegistry";
import { appleMusicPlaybackProvider } from "@/providers/appleMusic/playbackProvider";
import { fetchAppleMusicPlaylistTracks, fetchAppleMusicPlaylists } from "@/providers/appleMusic/playlists";
import { appleMusicPlaylists$, appleMusicPlaylistsStatus$ } from "@/providers/appleMusic/playlistsState";
import { appleMusicProvider } from "@/providers/appleMusic/provider";
import { appleMusicSearchProvider } from "@/providers/appleMusic/search";
import { buildAppleMusicLocalTrack, isAppleMusicUri } from "@/providers/appleMusic/trackMapping";
import { AppleMusicSettings } from "@/settings/AppleMusicSettings";

export const appleMusicPlugin: StreamingProviderPlugin = {
    provider: appleMusicProvider,
    search: appleMusicSearchProvider,
    playback: appleMusicPlaybackProvider,
    library: {
        sync: async () => {
            if (!isStreamingProviderEnabled("appleMusic") || !isAppleMusicAuthorized$.get()) {
                return;
            }

            try {
                await fetchAppleMusicPlaylists();
            } catch (error) {
                console.warn("Failed to sync Apple Music playlists", error);
            }
        },
        listPlaylists: fetchAppleMusicPlaylists,
        listPlaylistTracks: fetchAppleMusicPlaylistTracks,
        playlists$: appleMusicPlaylists$.playlists,
        status$: appleMusicPlaylistsStatus$,
    },
    tracks: {
        isUri: isAppleMusicUri,
        toLocalTrack: (track, options) => buildAppleMusicLocalTrack(track, options),
    },
    ui: {
        settings: AppleMusicSettings,
        badge: AppleMusicSourceBadge,
    },
};
