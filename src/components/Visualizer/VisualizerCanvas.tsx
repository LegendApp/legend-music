import React, { useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { Canvas, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";

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
    const audioPlayer = useAudioPlayer();
    const [bins, setBins] = useState<number[]>(() => new Array(binCount).fill(0));
    const [amplitude, setAmplitude] = useState(0);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const binsRef = useRef<Float32Array>(new Float32Array(binCount));
    const amplitudeRef = useRef(0);

    useEffect(() => {
        binsRef.current = new Float32Array(binCount);
        setBins(new Array(binCount).fill(0));
    }, [binCount]);

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

            const { bins: frameBins } = frame;
            const targetLength = frameBins.length;
            if (targetLength === 0) {
                return;
            }

            const reusable =
                binsRef.current.length === targetLength ? binsRef.current : new Float32Array(targetLength);
            for (let index = 0; index < targetLength; index += 1) {
                reusable[index] = frameBins[index];
            }

            binsRef.current = reusable;
            amplitudeRef.current = frame.rms;

            // Convert to regular array for React state
            setBins(Array.from(reusable));
            setAmplitude(frame.rms);
        });

        return () => {
            mounted = false;
            subscription.remove();
            audioPlayer.configureVisualizer({ enabled: false }).catch(() => {
                // Ignore disable errors during teardown
            });
        };
    }, [audioPlayer, binCount, fftSize, smoothing, throttleMs]);

    const { width, height } = canvasSize;

    // Create gradient
    const gradient = useMemo(() => {
        if (width === 0 || height === 0) {
            return null;
        }
        return (
            <LinearGradient
                start={vec(0, height)}
                end={vec(width, 0)}
                colors={gradientColors}
            />
        );
    }, [width, height]);

    // Render bars for spectrum mode
    const renderSpectrum = useMemo(() => {
        if (bins.length === 0 || width === 0 || height === 0) {
            return null;
        }

        const count = bins.length;
        const columnWidth = width / count;
        const barWidth = columnWidth * 0.72;
        const offset = (columnWidth - barWidth) / 2;

        return bins.map((magnitude, index) => {
            const clampedMagnitude = clamp01(magnitude);
            const barHeight = Math.max(height * 0.02, clampedMagnitude * height);
            const x = index * columnWidth + offset;
            const y = height - barHeight;

            return (
                <Rect
                    key={index}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                >
                    {gradient}
                </Rect>
            );
        });
    }, [bins, width, height, gradient]);

    // Render waveform
    const waveformPath = useMemo(() => {
        if (bins.length === 0 || width === 0 || height === 0) {
            return null;
        }

        const count = bins.length;
        const path = Skia.Path.Make();

        for (let index = 0; index < count; index += 1) {
            const ratio = count > 1 ? index / (count - 1) : 0;
            const x = ratio * width;
            const y = height - clamp01(bins[index]) * height;

            if (index === 0) {
                path.moveTo(x, y);
            } else {
                path.lineTo(x, y);
            }
        }

        return path;
    }, [bins, width, height]);

    const backgroundAlpha = 0.3 + clamp01(amplitude) * 0.2;

    return (
        <View
            style={style}
            onLayout={(event) => {
                const { width: w, height: h } = event.nativeEvent.layout;
                setCanvasSize({ width: w, height: h });
            }}
        >
            <Canvas style={{ flex: 1 }}>
                {/* Background */}
                <Rect x={0} y={0} width={width} height={height} color="#020617" opacity={backgroundAlpha} />

                {/* Visualizer content */}
                <Group>
                    {mode === "waveform" && waveformPath ? (
                        <Path path={waveformPath} style="stroke" strokeWidth={2}>
                            {gradient}
                        </Path>
                    ) : (
                        renderSpectrum
                    )}
                </Group>
            </Canvas>
        </View>
    );
}

export default VisualizerCanvas;
