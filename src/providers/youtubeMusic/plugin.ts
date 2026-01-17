import type { ProviderPlugin } from "@/providers/pluginRegistry";
import { YoutubeMusicSourceBadge } from "@/components/YoutubeMusicSourceBadge";
import { youtubeMusicProvider } from "@/providers/youtubeMusic/provider";
import { youtubeMusicSearchProvider } from "@/providers/youtubeMusic/search";
import { youtubeMusicPlaybackProvider } from "@/providers/youtubeMusic/playbackProvider";
import { YoutubeMusicWebPlayerBridge } from "@/providers/youtubeMusic/YoutubeMusicWebPlayerBridge";
import { buildYoutubeMusicLocalTrack, getYoutubeMusicVideoId } from "@/providers/youtubeMusic/trackMapping";
import { YoutubeMusicSettings } from "@/settings/YoutubeMusicSettings";

const isYoutubeMusicUri = (value: string): boolean => Boolean(getYoutubeMusicVideoId(value));

export const youtubeMusicPlugin: ProviderPlugin = {
    provider: youtubeMusicProvider,
    search: youtubeMusicSearchProvider,
    playback: youtubeMusicPlaybackProvider,
    tracks: {
        isUri: isYoutubeMusicUri,
        toLocalTrack: (track) => buildYoutubeMusicLocalTrack(track),
    },
    ui: {
        bridge: YoutubeMusicWebPlayerBridge,
        settings: YoutubeMusicSettings,
        badge: YoutubeMusicSourceBadge,
    },
};
