export type YoutubeMusicPlaybackState = {
    isPlaying?: boolean;
    positionSeconds?: number;
    durationSeconds?: number;
    isLoading?: boolean;
    didComplete?: boolean;
    error?: string | null;
};
