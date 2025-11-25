import { getPlaylistCacheSnapshot } from "@/systems/PlaylistCache";
import { settings$ } from "@/systems/Settings";
import { stateSaved$ } from "@/systems/State";
import { themeState$ } from "@/theme/ThemeProvider";

export function preloadPersistence() {
    getPlaylistCacheSnapshot();
    settings$.get();
    stateSaved$.get();
    themeState$.get();
}
