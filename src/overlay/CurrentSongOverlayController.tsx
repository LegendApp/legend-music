import { useObserveEffect } from "@legendapp/state/react";
import { useRef } from "react";

import { localPlayerState$ } from "@/components/LocalAudioPlayer";
import { appState$ } from "@/observables/appState";

import {
    currentSongOverlay$,
    presentCurrentSongOverlay,
    requestCurrentSongOverlayDismissal,
} from "./CurrentSongOverlayState";

export function CurrentSongOverlayController() {
    const lastTrackIdRef = useRef<string | null>(null);

    useObserveEffect(() => {
        const currentTrack = localPlayerState$.currentTrack.get();
        const isPlaying = localPlayerState$.isPlaying.get();
        const isAppActive = appState$.isActive.get();
        const trackId = currentTrack?.id ?? null;
        const shouldShow = Boolean(trackId && isPlaying && isAppActive);

        if (shouldShow && trackId) {
            if (trackId !== lastTrackIdRef.current) {
                presentCurrentSongOverlay();
            }
            lastTrackIdRef.current = trackId;
            return;
        }

        if (currentSongOverlay$.isWindowOpen.get()) {
            requestCurrentSongOverlayDismissal();
        }

        if (!trackId) {
            lastTrackIdRef.current = null;
        } else if (isAppActive) {
            lastTrackIdRef.current = trackId;
        }
    });

    return null;
}
