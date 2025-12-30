import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { memo, useMemo } from "react";

type SpotifySourceBadgeProps = {
    size?: number;
    className?: string;
};

function SpotifySourceBadgeComponent({ size = 12, className }: SpotifySourceBadgeProps) {
    const strokeWidth = Math.max(1, Math.round(size * 0.09));

    const [arcTop, arcMiddle, arcBottom] = useMemo(() => {
        const top = Skia.Path.Make();
        const middle = Skia.Path.Make();
        const bottom = Skia.Path.Make();

        top.addArc(Skia.XYWHRect(size * 0.18, size * 0.28, size * 0.64, size * 0.46), 210, 120);
        middle.addArc(Skia.XYWHRect(size * 0.22, size * 0.42, size * 0.56, size * 0.36), 210, 120);
        bottom.addArc(Skia.XYWHRect(size * 0.26, size * 0.56, size * 0.48, size * 0.26), 210, 120);

        return [top, middle, bottom];
    }, [size]);

    return (
        <Canvas style={{ width: size, height: size }} className={className}>
            <Circle cx={size / 2} cy={size / 2} r={size / 2} color="#1db954" />
            <Path path={arcTop} color="#0b0b0b" style="stroke" strokeWidth={strokeWidth} strokeCap="round" />
            <Path path={arcMiddle} color="#0b0b0b" style="stroke" strokeWidth={strokeWidth} strokeCap="round" />
            <Path path={arcBottom} color="#0b0b0b" style="stroke" strokeWidth={strokeWidth} strokeCap="round" />
        </Canvas>
    );
}

export const SpotifySourceBadge = memo(SpotifySourceBadgeComponent);
