import { Linking } from "react-native";
import { YoutubeMusicSourceBadge } from "@/components/YoutubeMusicSourceBadge";
import type { ContextMenuItem } from "@/native-modules/ContextMenu";
import type { ProviderPlugin } from "@/providers/pluginRegistry";
import { youtubeMusicProvider } from "@/providers/youtubeMusic/provider";
import { youtubeMusicSearchProvider } from "@/providers/youtubeMusic/search";
import { youtubeMusicPlaybackProvider } from "@/providers/youtubeMusic/playbackProvider";
import { YoutubeMusicWebPlayerBridge } from "@/providers/youtubeMusic/YoutubeMusicWebPlayerBridge";
import { buildYoutubeMusicLocalTrack, getYoutubeMusicVideoId } from "@/providers/youtubeMusic/trackMapping";
import { YoutubeMusicSettings } from "@/settings/YoutubeMusicSettings";
import type { LocalTrack } from "@/systems/LocalMusicState";

const YOUTUBE_MUSIC_CONTEXT_MENU_ITEMS = {
    openArtist: { id: "ytm-open-artist", title: "Open Artist in Browser" } as const,
    openAlbum: { id: "ytm-open-album", title: "Open Album in Browser" } as const,
};

const isYoutubeMusicUri = (value: string): boolean => Boolean(getYoutubeMusicVideoId(value));

const buildYoutubeMusicSearchUrl = (value: string): string =>
    `https://music.youtube.com/search?q=${encodeURIComponent(value)}`;

const getYoutubeMusicArtistUrl = (track: LocalTrack): string | null =>
    track.artistUrls?.[0] ?? (track.artist ? buildYoutubeMusicSearchUrl(track.artist) : null);

const getYoutubeMusicAlbumUrl = (track: LocalTrack): string | null =>
    track.albumUrl ?? (track.album ? buildYoutubeMusicSearchUrl(track.album) : null);

const openExternalUrl = async (url: string): Promise<boolean> => {
    try {
        await Linking.openURL(url);
        return true;
    } catch (error) {
        console.warn("Failed to open YouTube Music URL", error);
        return false;
    }
};

export const youtubeMusicPlugin: ProviderPlugin = {
    provider: youtubeMusicProvider,
    search: youtubeMusicSearchProvider,
    playback: youtubeMusicPlaybackProvider,
    tracks: {
        isUri: isYoutubeMusicUri,
        toLocalTrack: (track) => buildYoutubeMusicLocalTrack(track),
    },
    trackContextMenu: {
        getItems: (track) => {
            const items: ContextMenuItem[] = [];
            if (getYoutubeMusicArtistUrl(track)) {
                items.push(YOUTUBE_MUSIC_CONTEXT_MENU_ITEMS.openArtist);
            }
            if (getYoutubeMusicAlbumUrl(track)) {
                items.push(YOUTUBE_MUSIC_CONTEXT_MENU_ITEMS.openAlbum);
            }
            return items;
        },
        onSelect: async (selection, track) => {
            if (selection === YOUTUBE_MUSIC_CONTEXT_MENU_ITEMS.openArtist.id) {
                const url = getYoutubeMusicArtistUrl(track);
                return url ? openExternalUrl(url) : false;
            }
            if (selection === YOUTUBE_MUSIC_CONTEXT_MENU_ITEMS.openAlbum.id) {
                const url = getYoutubeMusicAlbumUrl(track);
                return url ? openExternalUrl(url) : false;
            }
            return false;
        },
    },
    ui: {
        bridge: YoutubeMusicWebPlayerBridge,
        settings: YoutubeMusicSettings,
        badge: YoutubeMusicSourceBadge,
    },
};
