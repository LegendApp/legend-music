import type { ContextMenuItem } from "@/native-modules/ContextMenu";
import { showInFinder } from "@/native-modules/FileDialog";
import type { StreamingProviderPlugin } from "@/providers/pluginRegistry";
import { localPlaybackProvider } from "@/providers/local/playbackProvider";
import { localSearchProvider } from "@/providers/local/search";
import { localProvider } from "@/providers/localProvider";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { initializeLocalMusic } from "@/systems/LocalMusicState";

const SHOW_IN_FINDER_MENU_ITEM: ContextMenuItem = { id: "show-in-finder", title: "Show in Finder" };

const isMp3Track = (track: LocalTrack): boolean => track.filePath.toLowerCase().endsWith(".mp3");

export const localPlugin: StreamingProviderPlugin = {
    provider: localProvider,
    initialize: () => {
        initializeLocalMusic();
    },
    search: localSearchProvider,
    playback: localPlaybackProvider,
    trackContextMenu: {
        getItems: (track) => (isMp3Track(track) ? [SHOW_IN_FINDER_MENU_ITEM] : []),
        onSelect: async (selection, track) => {
            if (selection !== SHOW_IN_FINDER_MENU_ITEM.id || !isMp3Track(track)) {
                return false;
            }

            await showInFinder(track.filePath);
            return true;
        },
    },
};
