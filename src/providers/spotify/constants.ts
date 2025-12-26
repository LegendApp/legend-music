import Config from "react-native-config";

export const SPOTIFY_AUTH_SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-library-read",
    "playlist-read-private",
] as const;

export const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export const SPOTIFY_CLIENT_ID = Config.SPOTIFY_CLIENT_ID ?? "";
export const SPOTIFY_REDIRECT_URI = "legendmusic://spotify-auth-callback";

export const SPOTIFY_DEVICE_NAME = "Legend Music (Web Playback)";

console.log("SPOTIFY_CLIENT_ID", SPOTIFY_CLIENT_ID);
