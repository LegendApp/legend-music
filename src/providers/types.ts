import type { LocalTrack } from "@/systems/LocalMusicState";

export type ProviderId = "local" | "spotify" | (string & {});

export interface ProviderCapabilities {
    supportsSearch: boolean;
    supportsLibrary: boolean;
    supportsPlayback: boolean;
    requiresPremium?: boolean;
    requiresWebView?: boolean;
}

export interface ProviderSession {
    isAuthenticated: boolean;
    userDisplayName?: string;
    userId?: string;
    userEmail?: string;
    product?: string;
    scopes?: string[];
    expiresAt?: number | null;
    deviceId?: string | null;
}

export interface ProviderTrack {
    provider: ProviderId;
    id: string;
    uri: string;
    name: string;
    durationMs?: number;
    addedAt?: number;
    artists?: string[];
    album?: string;
    thumbnail?: string;
    isExplicit?: boolean;
    marketRestrictions?: string[];
}

export interface ProviderPlaylist {
    provider: ProviderId;
    id: string;
    uri: string;
    name: string;
    owner?: string;
    trackCount?: number;
    images?: string[];
    isEditable?: boolean;
}

export interface ProviderInitOptions {
    onStateChange?: (session: ProviderSession) => void;
}

export interface Provider {
    id: ProviderId;
    name: string;
    capabilities: ProviderCapabilities;
    initialize(options?: ProviderInitOptions): Promise<void>;
    teardown(): void;
    getSession(): ProviderSession;
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
    id: ProviderId;
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

const playbackRegistry: Record<ProviderId, PlaybackProvider> = {};

export function registerPlaybackProvider(provider: PlaybackProvider): void {
    playbackRegistry[provider.id] = provider;
}

export function getPlaybackProvider(providerId: ProviderId): PlaybackProvider | undefined {
    return playbackRegistry[providerId];
}

export function getPlaybackProviderForTrack(track: LocalTrack): PlaybackProvider | undefined {
    const providerId = track.provider ?? "local";
    return getPlaybackProvider(providerId) ?? Object.values(playbackRegistry).find((entry) => entry.canHandle(track));
}
