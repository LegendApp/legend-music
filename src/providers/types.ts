import type { LocalTrack } from "@/systems/LocalMusicState";

export type StreamingProviderId = "local" | "spotify" | "appleMusic" | "youtubeMusic" | (string & {});

export interface StreamingProviderCapabilities {
    supportsSearch: boolean;
    supportsLibrary: boolean;
    supportsPlayback: boolean;
    requiresPremium?: boolean;
    requiresWebView?: boolean;
}

export interface StreamingProviderSession {
    isAuthenticated: boolean;
    userDisplayName?: string;
    userId?: string;
    userEmail?: string;
    product?: string;
    scopes?: string[];
    expiresAt?: number | null;
    deviceId?: string | null;
}

export interface StreamingProviderTrack {
    provider: StreamingProviderId;
    id: string;
    uri: string;
    name: string;
    durationMs?: number;
    addedAt?: number;
    artists?: string[];
    artistUrls?: string[];
    album?: string;
    albumUrl?: string;
    thumbnail?: string;
    isExplicit?: boolean;
    marketRestrictions?: string[];
    popularity?: number;
}

export interface StreamingProviderPlaylist {
    provider: StreamingProviderId;
    id: string;
    uri: string;
    name: string;
    owner?: string;
    trackCount?: number;
    images?: string[];
    isEditable?: boolean;
}

export interface StreamingProviderInitOptions {
    onStateChange?: (session: StreamingProviderSession) => void;
}

export interface StreamingProvider {
    id: StreamingProviderId;
    name: string;
    capabilities: StreamingProviderCapabilities;
    initialize(options?: StreamingProviderInitOptions): Promise<void>;
    teardown(): void;
    getSession(): StreamingProviderSession;
    login(): Promise<{ authorizeUrl: string; state: string }>;
    completeLogin(params: { code: string; state: string }): Promise<void>;
    logout(): Promise<void>;
    refresh(): Promise<void>;
}

export type PlaybackStateUpdate = {
    isPlaying?: boolean;
    positionSeconds?: number;
    durationSeconds?: number;
    artwork?: string | null;
    isLoading?: boolean;
    error?: string | null;
    didComplete?: boolean;
    isOccluded?: boolean;
    command?: "play" | "pause" | "toggle" | "next" | "previous";
};

export interface PlaybackProvider {
    id: StreamingProviderId;
    canHandle: (track: LocalTrack) => boolean;
    startsPlaybackOnLoad?: boolean;
    isAvailable?: () => boolean;
    load: (track: LocalTrack, options?: { startPositionSeconds?: number }) => Promise<void>;
    play: () => Promise<void>;
    pause: () => Promise<void>;
    seek: (positionSeconds: number) => Promise<void>;
    setVolume: (volume: number) => Promise<void>;
    stop?: () => Promise<void>;
    clearNowPlayingInfo?: () => void;
    getDurationSeconds: (track: LocalTrack) => number;
    hydrateTrackMetadata?: (track: LocalTrack) => Promise<Partial<LocalTrack> | null>;
    onStateChange?: (handler: (update: PlaybackStateUpdate) => void) => () => void;
}

const playbackRegistry: Record<StreamingProviderId, PlaybackProvider> = {};

export function registerPlaybackProvider(provider: PlaybackProvider): void {
    playbackRegistry[provider.id] = provider;
}

export function getPlaybackProvider(providerId: StreamingProviderId): PlaybackProvider | undefined {
    return playbackRegistry[providerId];
}

export function getPlaybackProviderForTrack(track: LocalTrack): PlaybackProvider | undefined {
    const providerId = track.provider ?? "local";
    return getPlaybackProvider(providerId) ?? Object.values(playbackRegistry).find((entry) => entry.canHandle(track));
}
