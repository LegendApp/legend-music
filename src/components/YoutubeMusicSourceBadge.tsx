import { memo } from "react";
import { Image } from "react-native";

type YoutubeMusicSourceBadgeProps = {
    size?: number;
    className?: string;
};

const youtubeMusicIcon = require("../../assets/icon-youtube-music.png");

function YoutubeMusicSourceBadgeComponent({ size = 12, className }: YoutubeMusicSourceBadgeProps) {
    return (
        <Image
            source={youtubeMusicIcon}
            style={{ width: size, height: size }}
            resizeMode="contain"
            className={className}
        />
    );
}

export const YoutubeMusicSourceBadge = memo(YoutubeMusicSourceBadgeComponent);
