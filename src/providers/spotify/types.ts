export interface SpotifyTokens {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
    scope: string[];
}

export interface SpotifyUserProfile {
    id: string;
    displayName?: string;
    email?: string;
    country?: string;
    product?: string;
    uri?: string;
}

export interface SpotifyAuthState extends SpotifyTokens {
    user: SpotifyUserProfile | null;
    codeVerifier?: string | null;
    codeState?: string | null;
}
