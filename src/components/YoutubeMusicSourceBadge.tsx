import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { memo, useMemo } from "react";

type YoutubeMusicSourceBadgeProps = {
    size?: number;
    className?: string;
};

function YoutubeMusicSourceBadgeComponent({ size = 12, className }: YoutubeMusicSourceBadgeProps) {
    const triangle = useMemo(() => {
        const path = Skia.Path.Make();
        path.moveTo(size * 0.42, size * 0.3);
        path.lineTo(size * 0.42, size * 0.7);
        path.lineTo(size * 0.72, size * 0.5);
        path.close();
        return path;
    }, [size]);

    return (
        <Canvas style={{ width: size, height: size }} className={className}>
            <Circle cx={size / 2} cy={size / 2} r={size / 2} color="#ff0033" />
            <Path path={triangle} color="#ffffff" />
        </Canvas>
    );
}

export const YoutubeMusicSourceBadge = memo(YoutubeMusicSourceBadgeComponent);
