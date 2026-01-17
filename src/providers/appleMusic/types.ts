export type AppleMusicTokens = {
    developerToken: string | null;
    developerTokenExpiresAt: number | null;
    userToken: string | null;
    userTokenExpiresAt: number | null;
};

export type AppleMusicUserProfile = {
    id?: string;
    name?: string;
    storefront?: string | null;
    subscription?: string | null;
};

export type AppleMusicAuthState = AppleMusicTokens & {
    storefront: string | null;
    user: AppleMusicUserProfile | null;
};
