import { memo } from "react";
import { Image } from "react-native";

type AppleMusicSourceBadgeProps = {
    size?: number;
    className?: string;
};

const appleMusicIcon = require("../../assets/icon-apple-music.jpg");

function AppleMusicSourceBadgeComponent({ size = 12, className }: AppleMusicSourceBadgeProps) {
    return (
        <Image
            source={appleMusicIcon}
            style={{ width: size, height: size, borderRadius: 4 }}
            resizeMode="contain"
            className={className}
        />
    );
}

export const AppleMusicSourceBadge = memo(AppleMusicSourceBadgeComponent);
