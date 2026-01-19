import { Canvas, ImageSVG, useSVG } from "@shopify/react-native-skia";
import { memo } from "react";

type SpotifySourceBadgeProps = {
    size?: number;
    className?: string;
};

const spotifyIcon = require("../../assets/Spotify Icon.svg");

function SpotifySourceBadgeComponent({ size = 12, className }: SpotifySourceBadgeProps) {
    const svg = useSVG(spotifyIcon);

    if (!svg) {
        return null;
    }

    return (
        <Canvas style={{ width: size, height: size }} className={className}>
            <ImageSVG svg={svg} x={0} y={0} width={size} height={size} />
        </Canvas>
    );
}

export const SpotifySourceBadge = memo(SpotifySourceBadgeComponent);
