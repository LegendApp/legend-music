import { use$ } from "@legendapp/state/react";
import {
    settings$,
    type BottomBarControlId,
    type PlaybackControlId,
    type UIControlLayout,
} from "@/systems/Settings";

const EMPTY_LAYOUT = { shown: [] as string[], hidden: [] as string[] };

export function usePlaybackControlLayout(): UIControlLayout<PlaybackControlId> {
    return use$(settings$.ui.playback) ?? (EMPTY_LAYOUT as UIControlLayout<PlaybackControlId>);
}

export function useBottomBarControlLayout(): UIControlLayout<BottomBarControlId> {
    return use$(settings$.ui.bottomBar) ?? (EMPTY_LAYOUT as UIControlLayout<BottomBarControlId>);
}
