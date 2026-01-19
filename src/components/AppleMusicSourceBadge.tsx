import { Canvas, ImageSVG, useSVG } from "@shopify/react-native-skia";
import { memo } from "react";

type AppleMusicSourceBadgeProps = {
    size?: number;
    className?: string;
};

const appleMusicIcon = require("../../assets/Apple Music Icon.svg");

function AppleMusicSourceBadgeComponent({ size = 12, className }: AppleMusicSourceBadgeProps) {
    const svg = useSVG(appleMusicIcon);

    if (!svg) {
        return null;
    }

    return (
        <Canvas style={{ width: size, height: size }} className={className}>
            <ImageSVG svg={svg} x={0} y={0} width={size} height={size} />
        </Canvas>
    );
}

export const AppleMusicSourceBadge = memo(AppleMusicSourceBadgeComponent);
