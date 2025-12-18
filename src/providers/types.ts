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
