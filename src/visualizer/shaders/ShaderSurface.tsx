import { Canvas, Rect, Shader, Skia, type Uniforms } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";

import { useAudioPlayer, type VisualizerConfig } from "@/native-modules/AudioPlayer";

import { decodeVisualizerBins } from "./decodeVisualizerPayload";

const UNIFORM_BIN_COUNT = 128;
const DEFAULT_BIN_COUNT = 96;
const DEFAULT_SMOOTHING = 0.6;
const DEFAULT_THROTTLE_MS = 16;
const DEFAULT_BACKGROUND = "#020617";
const BIN_ATTACK = 0.55;
const BIN_RELEASE = 0.18;
const AMPLITUDE_ATTACK = 0.45;
const AMPLITUDE_RELEASE = 0.18;

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
    binCountOverride?: number;
}

export function ShaderSurface({ definition, style, binCountOverride }: ShaderSurfaceProps) {
    const { shader, audioConfig, extendUniforms, backgroundColor = DEFAULT_BACKGROUND } = definition;

    const audioPlayer = useAudioPlayer();

    const maxUniformBins = definition.maxUniformBins
        ? clampBinCount(definition.maxUniformBins, UNIFORM_BIN_COUNT)
        : UNIFORM_BIN_COUNT;
    const configuredBinCount = clampBinCount(audioConfig?.binCount ?? DEFAULT_BIN_COUNT, maxUniformBins);
    const overrideBinCount = binCountOverride != null ? clampBinCount(binCountOverride, maxUniformBins) : null;
    const resolvedBinCount = overrideBinCount ?? configuredBinCount;
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

    const binsBufferRef = useRef<Float32Array>(createEmptyBins(maxUniformBins));
    const smoothedBinsRef = useRef<Float32Array>(createEmptyBins(maxUniformBins));

    const baseUniformRef = useRef<BaseUniformState>({
        resolution: [0, 0],
        time: 0,
        amplitude: 0,
        binCount: resolvedBinCount,
        bins: binsBufferRef.current,
    });
    const smoothedAmplitudeRef = useRef(0);

    const buildUniforms = useCallback((base: BaseUniformState): Uniforms => {
        const result: Uniforms = {
            u_resolution: [...base.resolution] as [number, number],
            u_time: base.time,
            u_amplitude: base.amplitude,
            u_binCount: base.binCount,
            u_bins: Array.from(base.bins),
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
    }, []);

    const uniformsSharedValue = useSharedValue(buildUniforms(baseUniformRef.current));
    const uniformsValueRef = useRef<SharedValue<Uniforms>>(uniformsSharedValue);

    const applyUniforms = useCallback(
        (updater: (base: BaseUniformState) => void) => {
            updater(baseUniformRef.current);
            uniformsValueRef.current.value = buildUniforms(baseUniformRef.current);
        },
        [buildUniforms],
    );

    useEffect(() => {
        if (binsBufferRef.current.length !== maxUniformBins) {
            binsBufferRef.current = createEmptyBins(maxUniformBins);
        }
        if (smoothedBinsRef.current.length !== maxUniformBins) {
            smoothedBinsRef.current = createEmptyBins(maxUniformBins);
        }

        binsBufferRef.current.fill(0);
        smoothedBinsRef.current.fill(0);

        applyUniforms((base) => {
            base.binCount = resolvedBinCount;
            base.bins = binsBufferRef.current;
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

            const incomingBins = decodeVisualizerBins(frame);
            const sourceCount = incomingBins.length;
            const targetCount = resolvedBinCount;
            const bins = binsBufferRef.current;

            if (sourceCount > 0) {
                const sourceRange = Math.max(sourceCount - 1, 1);
                for (let i = 0; i < targetCount; i += 1) {
                    const normalized = targetCount > 1 ? i / (targetCount - 1) : 0;
                    const mapped = normalized * sourceRange;
                    const leftIndex = Math.floor(mapped);
                    const rightIndex = Math.min(sourceCount - 1, leftIndex + 1);
                    const mix = mapped - leftIndex;
                    const leftValue = incomingBins[leftIndex] ?? 0;
                    const rightValue = incomingBins[rightIndex] ?? 0;
                    const sample = leftValue + (rightValue - leftValue) * mix;
                    const current = smoothedBinsRef.current[i] ?? 0;
                    const delta = sample - current;
                    const smoothing = delta > 0 ? BIN_ATTACK : BIN_RELEASE;
                    const next = current + delta * smoothing;
                    smoothedBinsRef.current[i] = next;
                    bins[i] = next;
                }
            } else {
                for (let i = 0; i < targetCount; i += 1) {
                    smoothedBinsRef.current[i] = 0;
                    bins[i] = 0;
                }
            }

            for (let i = targetCount; i < maxUniformBins; i += 1) {
                smoothedBinsRef.current[i] = 0;
                bins[i] = 0;
            }

            applyUniforms((base) => {
                base.bins = bins;
                base.binCount = targetCount;
                const rawAmplitude = frame.rms ?? 0;
                const current = smoothedAmplitudeRef.current;
                const delta = rawAmplitude - current;
                const smoothing = delta > 0 ? AMPLITUDE_ATTACK : AMPLITUDE_RELEASE;
                const nextAmplitude = current + delta * smoothing;
                smoothedAmplitudeRef.current = nextAmplitude;
                base.amplitude = nextAmplitude;
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
                        <Shader source={runtime.effect} uniforms={uniformsValueRef.current} />
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
