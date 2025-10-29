import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import { Canvas, Rect, Shader, Skia, type Uniforms } from "@shopify/react-native-skia";

import { useAudioPlayer, type VisualizerConfig } from "@/native-modules/AudioPlayer";

const MAX_UNIFORM_BINS = 128;
const DEFAULT_BIN_COUNT = 96;
const DEFAULT_SMOOTHING = 0.6;
const DEFAULT_THROTTLE_MS = 16;
const DEFAULT_BACKGROUND = "#020617";

const computeFftSize = (binCount: number) => {
    const minimum = Math.max(256, binCount * 16);
    const power = Math.ceil(Math.log2(minimum));
    return 2 ** power;
};

const clampBinCount = (value: number, max: number) => Math.max(1, Math.min(value, max));

type BaseUniformState = {
    resolution: [number, number];
    time: number;
    amplitude: number;
    binCount: number;
    bins: Float32Array;
};

const createEmptyBins = (length: number) => new Float32Array(length);

export interface ShaderUniformContext {
    resolution: { width: number; height: number };
    time: number;
    amplitude: number;
    bins: Float32Array;
    binCount: number;
}

export type ShaderUniformExtension = (
    context: ShaderUniformContext,
) => Record<string, number | number[] | Float32Array>;

export interface ShaderDefinition {
    shader: string;
    audioConfig?: Pick<VisualizerConfig, "binCount" | "fftSize" | "smoothing" | "throttleMs">;
    extendUniforms?: ShaderUniformExtension;
    maxUniformBins?: number;
    backgroundColor?: string;
}

interface ShaderSurfaceProps {
    definition: ShaderDefinition;
    style?: StyleProp<ViewStyle>;
}

export function ShaderSurface({ definition, style }: ShaderSurfaceProps) {
    const {
        shader,
        audioConfig,
        extendUniforms,
        maxUniformBins: maxBinsOverride,
        backgroundColor = DEFAULT_BACKGROUND,
    } = definition;

    const audioPlayer = useAudioPlayer();

    const maxUniformBins = Math.max(16, Math.min(maxBinsOverride ?? MAX_UNIFORM_BINS, MAX_UNIFORM_BINS));
    const resolvedBinCount = clampBinCount(audioConfig?.binCount ?? DEFAULT_BIN_COUNT, maxUniformBins);
    const resolvedFftSize = audioConfig?.fftSize ?? computeFftSize(resolvedBinCount);
    const resolvedSmoothing = audioConfig?.smoothing ?? DEFAULT_SMOOTHING;
    const resolvedThrottleMs = audioConfig?.throttleMs ?? DEFAULT_THROTTLE_MS;

    const runtime = useMemo(() => {
        try {
            const effect = Skia.RuntimeEffect.Make(shader);
            if (!effect) {
                return { effect: null, error: new Error("Shader compilation failed") };
            }
            return { effect, error: null };
        } catch (error) {
            return { effect: null, error: error as Error };
        }
    }, [shader]);

    const [runtimeError, setRuntimeError] = useState<string | null>(null);
    const extendUniformsRef = useRef<typeof extendUniforms>(extendUniforms);
    extendUniformsRef.current = extendUniforms;

    const baseUniformRef = useRef<BaseUniformState>({
        resolution: [0, 0],
        time: 0,
        amplitude: 0,
        binCount: resolvedBinCount,
        bins: createEmptyBins(maxUniformBins),
    });

    const buildUniforms = useCallback(
        (base: BaseUniformState): Uniforms => {
            const result: Uniforms = {
                u_resolution: [...base.resolution] as [number, number],
                u_time: base.time,
                u_amplitude: base.amplitude,
                u_binCount: base.binCount,
                u_bins: base.bins,
            };

            const extend = extendUniformsRef.current;
            if (extend) {
                Object.assign(
                    result,
                    extend({
                        resolution: { width: base.resolution[0], height: base.resolution[1] },
                        time: base.time,
                        amplitude: base.amplitude,
                        bins: base.bins,
                        binCount: base.binCount,
                    }),
                );
            }

            return result;
        },
        [],
    );

    const [uniforms, setUniforms] = useState<Uniforms>(() => buildUniforms(baseUniformRef.current));

    const applyUniforms = useCallback(
        (updater: (base: BaseUniformState) => void) => {
            updater(baseUniformRef.current);
            setUniforms(buildUniforms(baseUniformRef.current));
        },
        [buildUniforms],
    );

    useEffect(() => {
        applyUniforms((base) => {
            base.binCount = resolvedBinCount;
            base.bins = createEmptyBins(maxUniformBins);
            base.amplitude = 0;
        });
    }, [resolvedBinCount, maxUniformBins, applyUniforms]);

    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const handleLayout = useCallback(
        (event: LayoutChangeEvent) => {
            const { width, height } = event.nativeEvent.layout;
            if (width <= 0 || height <= 0) {
                return;
            }

            setCanvasSize({ width, height });
            applyUniforms((base) => {
                base.resolution = [width, height];
            });
        },
        [applyUniforms],
    );

    useEffect(() => {
        if (!runtime.effect) {
            return;
        }

        let frameId: number;
        const start = Date.now();

        const tick = () => {
            const now = Date.now();
            applyUniforms((base) => {
                base.time = (now - start) / 1000;
            });
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [runtime.effect, applyUniforms]);

    useEffect(() => {
        if (!runtime.effect) {
            return;
        }

        let isMounted = true;
        setRuntimeError(null);

        audioPlayer
            .configureVisualizer({
                enabled: true,
                binCount: resolvedBinCount,
                fftSize: resolvedFftSize,
                smoothing: resolvedSmoothing,
                throttleMs: resolvedThrottleMs,
            })
            .catch((error) => {
                if (!isMounted) {
                    return;
                }
                setRuntimeError(error instanceof Error ? error.message : String(error));
            });

        const subscription = audioPlayer.addListener("onVisualizerFrame", (frame) => {
            if (!isMounted) {
                return;
            }

            const incomingBins = frame.bins ?? [];
            const nextCount = clampBinCount(incomingBins.length || resolvedBinCount, maxUniformBins);
            const buffer = createEmptyBins(maxUniformBins);

            for (let index = 0; index < nextCount && index < incomingBins.length; index += 1) {
                buffer[index] = incomingBins[index];
            }

            applyUniforms((base) => {
                base.bins = buffer;
                base.binCount = nextCount;
                base.amplitude = frame.rms;
            });
        });

        return () => {
            isMounted = false;
            subscription.remove();
            audioPlayer.configureVisualizer({ enabled: false }).catch(() => {
                // Ignore teardown errors
            });
        };
    }, [
        audioPlayer,
        runtime.effect,
        resolvedBinCount,
        resolvedFftSize,
        resolvedSmoothing,
        resolvedThrottleMs,
        maxUniformBins,
        applyUniforms,
    ]);

    useEffect(() => {
        if (runtime.error) {
            console.error("[ShaderSurface] Failed to compile shader:", runtime.error);
        }
    }, [runtime.error]);

    const errorMessage = runtime.error
        ? `Shader failed to compile: ${runtime.error.message}`
        : runtimeError
          ? `Visualizer unavailable: ${runtimeError}`
          : null;

    return (
        <View style={[styles.container, style]} onLayout={handleLayout}>
            <Canvas style={StyleSheet.absoluteFill}>
                <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} color={backgroundColor} />
                {runtime.effect ? (
                    <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height}>
                        <Shader source={runtime.effect} uniforms={uniforms} />
                    </Rect>
                ) : null}
            </Canvas>

            {errorMessage ? (
                <View pointerEvents="none" style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: "relative",
    },
    errorContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    errorText: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 14,
        textAlign: "center",
    },
});

export default ShaderSurface;
