export const YOUTUBE_AUTH_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/youtube.readonly",
] as const;

export const YOUTUBE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const YOUTUBE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YOUTUBE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const YOUTUBE_REDIRECT_URI = "legendmusic://youtube-auth-callback";
