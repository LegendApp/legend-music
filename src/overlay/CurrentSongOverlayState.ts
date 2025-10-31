import { observable } from "@legendapp/state";

import {
    OVERLAY_MAX_DISPLAY_DURATION_SECONDS,
    OVERLAY_MIN_DISPLAY_DURATION_SECONDS,
    settings$,
} from "@/systems/Settings";

export const DEFAULT_OVERLAY_DISPLAY_DURATION_MS = 5000;

export const currentSongOverlay$ = observable({
    isWindowOpen: false,
    presentationId: 0,
    isExiting: false,
});

let hideTimer: ReturnType<typeof setTimeout> | null = null;

const clearHideTimer = () => {
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }
};

const getDisplayDurationMs = () => {
    const configuredSeconds = settings$.overlay.displayDurationSeconds.get();
    const numericSeconds =
        typeof configuredSeconds === "number" ? configuredSeconds : DEFAULT_OVERLAY_DISPLAY_DURATION_MS / 1000;
    const clampedSeconds = Math.min(
        Math.max(numericSeconds, OVERLAY_MIN_DISPLAY_DURATION_SECONDS),
        OVERLAY_MAX_DISPLAY_DURATION_SECONDS,
    );
    return clampedSeconds * 1000;
};

const scheduleHideTimer = (durationMs: number = getDisplayDurationMs()) => {
    clearHideTimer();
    hideTimer = setTimeout(() => {
        requestCurrentSongOverlayDismissal();
    }, durationMs);
};

export const presentCurrentSongOverlay = () => {
    if (!settings$.overlay.enabled.get()) {
        cancelCurrentSongOverlay();
        return;
    }
    clearHideTimer();
    currentSongOverlay$.isExiting.set(false);
    currentSongOverlay$.isWindowOpen.set(true);
    const nextPresentationId = currentSongOverlay$.presentationId.get() + 1;
    currentSongOverlay$.presentationId.set(nextPresentationId);
    scheduleHideTimer();
};

export const requestCurrentSongOverlayDismissal = () => {
    if (currentSongOverlay$.isExiting.get()) {
        return;
    }
    clearHideTimer();
    currentSongOverlay$.isExiting.set(true);
};

export const finalizeCurrentSongOverlayDismissal = () => {
    clearHideTimer();
    currentSongOverlay$.isExiting.set(false);
    currentSongOverlay$.isWindowOpen.set(false);
};

export const cancelCurrentSongOverlay = () => {
    clearHideTimer();
    currentSongOverlay$.isExiting.set(false);
    currentSongOverlay$.isWindowOpen.set(false);
};

export const resetCurrentSongOverlayTimer = () => {
    if (!currentSongOverlay$.isWindowOpen.get()) {
        return;
    }
    scheduleHideTimer();
};
