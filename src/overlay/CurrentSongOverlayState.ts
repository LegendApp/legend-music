import { observable } from "@legendapp/state";

export const currentSongOverlay$ = observable({
    isOpen: false,
});

export const showCurrentSongOverlay = () => {
    currentSongOverlay$.isOpen.set(true);
};

export const hideCurrentSongOverlay = () => {
    currentSongOverlay$.isOpen.set(false);
};
