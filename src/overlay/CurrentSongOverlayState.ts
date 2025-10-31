import { observable } from "@legendapp/state";

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

const scheduleHideTimer = (durationMs: number = DEFAULT_OVERLAY_DISPLAY_DURATION_MS) => {
    clearHideTimer();
    hideTimer = setTimeout(() => {
        requestCurrentSongOverlayDismissal();
    }, durationMs);
};

export const presentCurrentSongOverlay = () => {
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
