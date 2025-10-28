import { useCallback, useEffect, useMemo, useRef } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import {
    Canvas,
    PaintStyle,
    Skia,
    TileMode,
    useDrawCallback,
    useValue,
    vec,
} from "@shopify/react-native-skia";

import { useAudioPlayer, type VisualizerConfig } from "@/native-modules/AudioPlayer";

const DEFAULT_CONFIG: Required<Omit<VisualizerConfig, "enabled">> & { throttleMs: number } = {
    fftSize: 1024,
    binCount: 64,
    smoothing: 0.6,
    throttleMs: 33,
};

export type VisualizerMode = "spectrum" | "waveform";

export type VisualizerCanvasProps = {
    binCount?: number;
    fftSize?: number;
    smoothing?: number;
    throttleMs?: number;
    mode?: VisualizerMode;
    style?: StyleProp<ViewStyle>;
};

const gradientColors = ["#0ea5e9", "#a855f7", "#f97316"] as const;

const clamp01 = (value: number) => {
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
};

export function VisualizerCanvas({
    binCount = DEFAULT_CONFIG.binCount,
    fftSize = DEFAULT_CONFIG.fftSize,
    smoothing = DEFAULT_CONFIG.smoothing,
    throttleMs = DEFAULT_CONFIG.throttleMs,
    mode = "spectrum",
    style,
}: VisualizerCanvasProps) {
    const audioPlayer = useMemo(() => useAudioPlayer(), []);
    const binsValue = useValue<Float32Array>(new Float32Array(binCount));
    const amplitudeValue = useValue(0);

    const barPaintRef = useRef<ReturnType<typeof Skia.Paint>>();
    if (!barPaintRef.current) {
        const paint = Skia.Paint();
        paint.setStyle(PaintStyle.Fill);
        paint.setAntiAlias(true);
        barPaintRef.current = paint;
    }

    const linePaintRef = useRef<ReturnType<typeof Skia.Paint>>();
    if (!linePaintRef.current) {
        const paint = Skia.Paint();
        paint.setStyle(PaintStyle.Stroke);
        paint.setStrokeWidth(2);
        paint.setAntiAlias(true);
        linePaintRef.current = paint;
    }

    const backgroundPaintRef = useRef<ReturnType<typeof Skia.Paint>>();
    if (!backgroundPaintRef.current) {
        const paint = Skia.Paint();
        paint.setStyle(PaintStyle.Fill);
        paint.setColor(Skia.Color("#020617"));
        backgroundPaintRef.current = paint;
    }

    const gradientRef = useRef<ReturnType<typeof Skia.Shader.MakeLinearGradient> | null>(null);
    const gradientSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

    useEffect(() => {
        binsValue.current = new Float32Array(binCount);
    }, [binCount, binsValue]);

    useEffect(() => {
        let mounted = true;

        audioPlayer
            .configureVisualizer({
                enabled: true,
                binCount,
                fftSize,
                smoothing,
                throttleMs,
            })
            .catch((error) => {
                console.warn("Visualizer enable failed", error);
            });

        const subscription = audioPlayer.addListener("onVisualizerFrame", (frame) => {
            if (!mounted) {
                return;
            }

            const { bins } = frame;
            const targetLength = bins.length;
            if (targetLength === 0) {
                return;
            }

            const reusable = binsValue.current.length === targetLength ? binsValue.current : new Float32Array(targetLength);
            for (let index = 0; index < targetLength; index += 1) {
                reusable[index] = bins[index];
            }

            binsValue.current = reusable;
            amplitudeValue.current = frame.rms;
        });

        return () => {
            mounted = false;
            subscription.remove();
            audioPlayer.configureVisualizer({ enabled: false }).catch(() => {
                // Ignore disable errors during teardown
            });
        };
    }, [audioPlayer, amplitudeValue, binCount, fftSize, smoothing, throttleMs, binsValue]);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== gradientSizeRef.current.width || height !== gradientSizeRef.current.height) {
            gradientRef.current = null;
        }
    }, []);

    const draw = useDrawCallback(
        (canvas, info) => {
            const { width, height } = info;
            if (width <= 0 || height <= 0) {
                return;
            }

            const bins = binsValue.current;
            const count = bins.length;

            const backgroundPaint = backgroundPaintRef.current;
            const barPaint = barPaintRef.current;
            const linePaint = linePaintRef.current;
            if (!backgroundPaint || !barPaint || !linePaint) {
                return;
            }

            if (!gradientRef.current || gradientSizeRef.current.width !== width || gradientSizeRef.current.height !== height) {
                gradientRef.current = Skia.Shader.MakeLinearGradient(
                    vec(0, height),
                    vec(width, 0),
                    gradientColors.map((color) => Skia.Color(color)),
                    null,
                    TileMode.Clamp,
                );
                gradientSizeRef.current = { width, height };
            }

            const gradient = gradientRef.current;
            if (gradient) {
                barPaint.setShader(gradient);
                linePaint.setShader(gradient);
            }

            const amplitude = clamp01(amplitudeValue.current);
            backgroundPaint.setAlphaf(0.3 + amplitude * 0.2);
            canvas.drawRect(Skia.XYWHRect(0, 0, width, height), backgroundPaint);

            if (count === 0) {
                return;
            }

            if (mode === "waveform") {
                const strokeBaseline = height * 0.5;
                let previousX = 0;
                let previousY = strokeBaseline;
                for (let index = 0; index < count; index += 1) {
                    const ratio = count > 1 ? index / (count - 1) : 0;
                    const x = ratio * width;
                    const y = height - clamp01(bins[index]) * height;

                    if (index === 0) {
                        previousX = x;
                        previousY = y;
                        continue;
                    }

                    canvas.drawLine(previousX, previousY, x, y, linePaint);
                    previousX = x;
                    previousY = y;
                }
            } else {
                const columnWidth = width / count;
                const barWidth = columnWidth * 0.72;
                const offset = (columnWidth - barWidth) / 2;

                for (let index = 0; index < count; index += 1) {
                    const magnitude = clamp01(bins[index]);
                    const barHeight = Math.max(height * 0.02, magnitude * height);
                    const x = index * columnWidth + offset;
                    canvas.drawRect(
                        Skia.XYWHRect(x, height - barHeight, barWidth, barHeight),
                        barPaint,
                    );
                }
            }
        },
        [mode],
    );

    return (
        <View style={style} onLayout={onLayout}>
            <Canvas style={{ flex: 1 }} onDraw={draw} />
        </View>
    );
}

export default VisualizerCanvas;
