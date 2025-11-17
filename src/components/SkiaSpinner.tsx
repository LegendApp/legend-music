import { memo, useEffect, useMemo } from "react";
import { Canvas, Group, Path, Skia, SweepGradient, vec } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

type SkiaSpinnerProps = {
    size?: number;
    thickness?: number;
    color?: string;
    trailColor?: string;
    speedMs?: number;
    className?: string;
};

function applyAlpha(hexColor: string, alpha: number): string {
    const sanitized = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;
    if (!/^[0-9a-f]{6}$/i.test(sanitized)) {
        return hexColor;
    }
    const int = Number.parseInt(sanitized, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    const cappedAlpha = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${cappedAlpha})`;
}

function SkiaSpinnerComponent({
    size = 32,
    thickness = 4,
    color = "#5ac8fa",
    trailColor = "rgba(255,255,255,0.08)",
    speedMs = 1100,
    className,
}: SkiaSpinnerProps) {
    const radius = size / 2;
    const inset = thickness / 2;

    const arcPath = useMemo(() => {
        const path = Skia.Path.Make();
        path.addArc(Skia.XYWHRect(inset, inset, size - thickness, size - thickness), 0, 285);
        return path;
    }, [inset, size, thickness]);

    const trackPath = useMemo(() => {
        const path = Skia.Path.Make();
        path.addArc(Skia.XYWHRect(inset, inset, size - thickness, size - thickness), 0, 360);
        return path;
    }, [inset, size, thickness]);

    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(withTiming(Math.PI * 2, { duration: speedMs, easing: Easing.linear }), -1, false);
    }, [rotation, speedMs]);

    const animatedTransform = useDerivedValue(() => [{ rotate: rotation.value }]);

    return (
        <Canvas style={{ width: size, height: size }} className={className}>
            <Path path={trackPath} color={trailColor} style="stroke" strokeWidth={thickness} strokeCap="round" />
            <Group origin={vec(radius, radius)} transform={animatedTransform}>
                <Path path={arcPath} style="stroke" strokeWidth={thickness} strokeCap="round">
                    <SweepGradient
                        c={vec(radius, radius)}
                        colors={[applyAlpha(color, 0), color, applyAlpha(color, 0.1)]}
                        positions={[0, 0.55, 1]}
                    />
                </Path>
            </Group>
        </Canvas>
    );
}

export const SkiaSpinner = memo(SkiaSpinnerComponent);
