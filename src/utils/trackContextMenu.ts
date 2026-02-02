import type { ContextMenuItem } from "@/native-modules/ContextMenu";
import { getStreamingProviderPlugin } from "@/providers/pluginRegistry";
import type { AiGenerationPopupAnchorRect } from "@/systems/ai/generationPopup";
import { openAiGenerationPopup } from "@/systems/ai/generationPopup";
import { selectLibraryAlbum, selectLibraryArtist } from "@/systems/LibraryState";
import type { LocalTrack } from "@/systems/LocalMusicState";

export const TRACK_CONTEXT_MENU_ITEMS = {
    queueAdd: { id: "queue-add", title: "Add to Queue" } as const,
    queuePlayNext: { id: "queue-play-next", title: "Play Next" } as const,
    startMix: { id: "ai-start-mix", title: "Start mix" } as const,
    addMoreLikeThis: { id: "ai-add-more-like-this", title: "Add more like this" } as const,
    goToArtist: { id: "go-to-artist", title: "Go to Artist" } as const,
    goToAlbum: { id: "go-to-album", title: "Go to Album" } as const,
};

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
        items.push(TRACK_CONTEXT_MENU_ITEMS.startMix, TRACK_CONTEXT_MENU_ITEMS.addMoreLikeThis);

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
    anchorRect?: AiGenerationPopupAnchorRect | null;
    onQueueAction?: (action: QueueAction) => void;
    onCustomSelect?: (selection: string) => void | Promise<void>;
}

export async function handleTrackContextMenuSelection({
    selection,
    track,
    anchorRect,
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

    if (selection === TRACK_CONTEXT_MENU_ITEMS.startMix.id && track) {
        openAiGenerationPopup({
            title: TRACK_CONTEXT_MENU_ITEMS.startMix.title,
            action: "start-mix",
            seedTracks: [track],
            anchorRect: anchorRect ?? null,
        });
        return;
    }

    if (selection === TRACK_CONTEXT_MENU_ITEMS.addMoreLikeThis.id && track) {
        openAiGenerationPopup({
            title: TRACK_CONTEXT_MENU_ITEMS.addMoreLikeThis.title,
            action: "add-more-like-this",
            seedTracks: [track],
            anchorRect: anchorRect ?? null,
        });
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
