export type YoutubeTokens = {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
    scope: string[];
};

export type YoutubeUserProfile = {
    id: string;
    displayName?: string;
    email?: string;
    picture?: string;
};

export type YoutubeAuthState = YoutubeTokens & {
    user: YoutubeUserProfile | null;
    codeVerifier: string | null;
    codeState: string | null;
};
