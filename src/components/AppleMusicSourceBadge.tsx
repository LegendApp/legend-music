import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { memo, useMemo } from "react";

type AppleMusicSourceBadgeProps = {
    size?: number;
    className?: string;
};

function AppleMusicSourceBadgeComponent({ size = 12, className }: AppleMusicSourceBadgeProps) {
    const strokeWidth = Math.max(1, Math.round(size * 0.08));

    const stem = useMemo(() => {
        const path = Skia.Path.Make();
        path.moveTo(size * 0.44, size * 0.66);
        path.lineTo(size * 0.44, size * 0.28);
        path.lineTo(size * 0.74, size * 0.22);
        return path;
    }, [size]);

    return (
        <Canvas style={{ width: size, height: size }} className={className}>
            <Circle cx={size / 2} cy={size / 2} r={size / 2} color="#fa233b" />
            <Circle cx={size * 0.42} cy={size * 0.68} r={size * 0.14} color="#ffffff" />
            <Circle cx={size * 0.72} cy={size * 0.58} r={size * 0.12} color="#ffffff" />
            <Path path={stem} color="#ffffff" style="stroke" strokeWidth={strokeWidth} strokeCap="round" />
        </Canvas>
    );
}

export const AppleMusicSourceBadge = memo(AppleMusicSourceBadgeComponent);
