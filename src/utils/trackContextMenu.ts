import { queueControls } from "@/components/AudioPlayer";
import { showToast } from "@/components/Toast";
import type { ContextMenuItem } from "@/native-modules/ContextMenu";
import { getStreamingProviderPlugin } from "@/providers/pluginRegistry";
import type { AiPromptSource } from "@/systems/ai/promptSource";
import { selectLibraryAlbum, selectLibraryArtist } from "@/systems/LibraryState";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { fetchSuggestions } from "@/systems/suggestions";

const MIX_TARGET_COUNT = 20;

export const TRACK_CONTEXT_MENU_ITEMS = {
    queueAdd: { id: "queue-add", title: "Add to Queue" } as const,
    queuePlayNext: { id: "queue-play-next", title: "Play Next" } as const,
    goToArtist: { id: "go-to-artist", title: "Go to Artist" } as const,
    goToAlbum: { id: "go-to-album", title: "Go to Album" } as const,
};

export async function startTrackMix(track: LocalTrack, promptSource: AiPromptSource): Promise<void> {
    queueControls.replace([track]);

    try {
        const { tracks, unresolved } = await fetchSuggestions({
            mode: "queue-extension",
            source: "manual",
            promptSource,
            seedTracks: [track],
            count: MIX_TARGET_COUNT,
        });

        if (tracks.length === 0) {
            showToast("No tracks were suggested.", "error");
            return;
        }

        queueControls.append(tracks);
        const addedLabel = tracks.length === 1 ? "track" : "tracks";
        showToast(`Added ${tracks.length} ${addedLabel} to the queue`, "info");
        if (unresolved && unresolved.length > 0) {
            showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Mix generation failed";
        showToast(message, "error");
    }
}

type BuildTrackContextMenuOptions = {
    track?: LocalTrack | null;
    includeQueueActions?: boolean;
    extraItems?: ContextMenuItem[];
};

export function buildTrackContextMenuItems(options: BuildTrackContextMenuOptions = {}): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (options.includeQueueActions) {
        items.push(TRACK_CONTEXT_MENU_ITEMS.queueAdd, TRACK_CONTEXT_MENU_ITEMS.queuePlayNext);
    }

    if (options.track) {
        const artist = options.track.artist?.trim();
        if (artist) {
            items.push(TRACK_CONTEXT_MENU_ITEMS.goToArtist);
        }

        const album = options.track.album?.trim();
        if (album) {
            items.push(TRACK_CONTEXT_MENU_ITEMS.goToAlbum);
        }

        const providerId = options.track.provider ?? "local";
        const providerItems = getStreamingProviderPlugin(providerId)?.trackContextMenu?.getItems(options.track) ?? [];
        if (providerItems.length > 0) {
            items.push(...providerItems);
        }
    }

    if (options.extraItems?.length) {
        items.push(...options.extraItems);
    }

    return items;
}

type QueueAction = "enqueue" | "play-next";

interface HandleTrackContextMenuSelectionOptions {
    selection: string | null;
    track?: LocalTrack | null;
    onQueueAction?: (action: QueueAction) => void;
    onCustomSelect?: (selection: string) => void | Promise<void>;
}

export async function handleTrackContextMenuSelection({
    selection,
    track,
    onQueueAction,
    onCustomSelect,
}: HandleTrackContextMenuSelectionOptions): Promise<void> {
    if (!selection) {
        return;
    }

    if (selection === TRACK_CONTEXT_MENU_ITEMS.queuePlayNext.id) {
        onQueueAction?.("play-next");
        return;
    }

    if (selection === TRACK_CONTEXT_MENU_ITEMS.queueAdd.id) {
        onQueueAction?.("enqueue");
        return;
    }

    if (selection === TRACK_CONTEXT_MENU_ITEMS.goToArtist.id && track?.artist?.trim()) {
        selectLibraryArtist(track.artist);
        return;
    }

    if (selection === TRACK_CONTEXT_MENU_ITEMS.goToAlbum.id && track?.album?.trim()) {
        selectLibraryAlbum(track.album, track.artist);
        return;
    }

    if (track) {
        const providerId = track.provider ?? "local";
        const providerHandler = getStreamingProviderPlugin(providerId)?.trackContextMenu?.onSelect;
        if (providerHandler) {
            const handled = await providerHandler(selection, track);
            if (handled) {
                return;
            }
        }
    }

    await onCustomSelect?.(selection);
}
