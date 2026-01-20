import { memo } from "react";
import { Image } from "react-native";

type SpotifySourceBadgeProps = {
    size?: number;
    className?: string;
};

const spotifyIcon = require("../../assets/icon-spotify.png");

function SpotifySourceBadgeComponent({ size = 12, className }: SpotifySourceBadgeProps) {
    return (
        <Image
            source={spotifyIcon}
            style={{ width: size, height: size }}
            resizeMode="contain"
            className={className}
        />
    );
}

export const SpotifySourceBadge = memo(SpotifySourceBadgeComponent);
