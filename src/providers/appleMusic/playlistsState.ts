import { observable } from "@legendapp/state";
import { appleMusicState$, createAppleMusicState } from "@/providers/appleMusic/state";

export const appleMusicPlaylists$ = appleMusicState$;

export const appleMusicPlaylistsStatus$ = observable({
    isLoading: false,
    error: null as string | null,
    tracksLoading: {} as Record<string, boolean>,
    tracksError: {} as Record<string, string | null>,
});

export function clearAppleMusicPlaylistsCache(): void {
    appleMusicPlaylists$.set(createAppleMusicState());
    appleMusicPlaylistsStatus$.isLoading.set(false);
    appleMusicPlaylistsStatus$.error.set(null);
    appleMusicPlaylistsStatus$.tracksLoading.set({});
    appleMusicPlaylistsStatus$.tracksError.set({});
}
