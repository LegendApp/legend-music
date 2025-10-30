import { Canvas, Rect, Shader, Skia, type Uniforms } from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";

import { useAudioPlayer, type VisualizerConfig } from "@/native-modules/AudioPlayer";

import { visualizerDiagnostics$ } from "../diagnostics";
import { decodeVisualizerBins } from "./decodeVisualizerPayload";

const UNIFORM_BIN_COUNT = 128;
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
    const [jsiBindingsAvailable, setJsiBindingsAvailable] = useState(false);
    const extendUniformsRef = useRef<typeof extendUniforms>(extendUniforms);
    extendUniformsRef.current = extendUniforms;

    const binsBufferRef = useRef<Float32Array>(createEmptyBins(maxUniformBins));

    const baseUniformRef = useRef<BaseUniformState>({
        resolution: [0, 0],
        time: 0,
        amplitude: 0,
        binCount: resolvedBinCount,
        bins: binsBufferRef.current,
    });
    const startTimestampRef = useRef<number | null>(null);
    const fallbackStartSecondsRef = useRef<number | null>(null);
    const lastFrameSecondsRef = useRef<number | null>(null);
    const fpsEstimateRef = useRef(0);

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
        binsBufferRef.current.fill(0);

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

        let isMounted = true;
        setRuntimeError(null);

        if (!jsiBindingsAvailable) {
            audioPlayer
                .installVisualizerBindings()
                .then((result) => {
                    if (!isMounted) {
                        return;
                    }
                    if (result?.installed) {
                        setJsiBindingsAvailable(true);
                    }
                })
                .catch(() => {
                    if (!isMounted) {
                        return;
                    }
                    setJsiBindingsAvailable(false);
                });
        }

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

            let amplitude = frame.rms ?? 0;
            let incomingBins: Float32Array | null = null;
            let sourceCount = 0;
            let frameTimestamp = typeof frame.timestamp === "number" ? frame.timestamp : null;
            let processDurationMs = typeof frame.processDurationMs === "number" ? frame.processDurationMs : 0;
            let throttleMs = typeof frame.throttleMs === "number" ? frame.throttleMs : 0;

            const legendModule = (
                globalThis as {
                    LegendAudioVisualizer?: {
                        getFrame?: () => { bins?: unknown; binCount?: number; rms?: number; timestamp?: number };
                    };
                }
            ).LegendAudioVisualizer;

            if (legendModule?.getFrame) {
                try {
                    const typedFrame = legendModule.getFrame();
                    if (typedFrame && typedFrame.bins instanceof Float32Array) {
                        const typedArray = typedFrame.bins as Float32Array;
                        const typedCount =
                            typeof typedFrame.binCount === "number" && typedFrame.binCount > 0
                                ? typedFrame.binCount
                                : typedArray.length;

                        if (typedArray.length > 0 && typedCount > 0) {
                            incomingBins =
                                typedCount < typedArray.length ? typedArray.subarray(0, typedCount) : typedArray;
                            sourceCount = incomingBins.length;
                        }

                        if (typeof typedFrame.rms === "number") {
                            amplitude = typedFrame.rms;
                        }
                        if (typeof typedFrame.timestamp === "number") {
                            frameTimestamp = typedFrame.timestamp;
                        }
                        if (typeof typedFrame.processDurationMs === "number") {
                            processDurationMs = typedFrame.processDurationMs;
                        }
                        if (typeof typedFrame.throttleMs === "number") {
                            throttleMs = typedFrame.throttleMs;
                        }
                    }
                } catch (_error) {
                    // Ignore binding fetch errors and fall back to payload decoding.
                }
            }

            if (!incomingBins) {
                const decoded = decodeVisualizerBins(frame);
                if (decoded.length > 0) {
                    incomingBins = decoded;
                    sourceCount = decoded.length;
                }
            }

            const targetCount = resolvedBinCount;
            const bins = binsBufferRef.current;

            if (incomingBins && sourceCount > 0) {
                if (sourceCount === targetCount) {
                    bins.set(incomingBins.subarray(0, targetCount));
                } else {
                    const sourceRange = Math.max(sourceCount - 1, 1);
                    for (let i = 0; i < targetCount; i += 1) {
                        const normalized = targetCount > 1 ? i / (targetCount - 1) : 0;
                        const mapped = normalized * sourceRange;
                        const leftIndex = Math.floor(mapped);
                        const rightIndex = Math.min(sourceCount - 1, leftIndex + 1);
                        const mix = mapped - leftIndex;
                        const leftValue = incomingBins[leftIndex] ?? 0;
                        const rightValue = incomingBins[rightIndex] ?? 0;
                        bins[i] = leftValue + (rightValue - leftValue) * mix;
                    }
                }
            } else {
                bins.fill(0, 0, targetCount);
                amplitude = 0;
            }

            bins.fill(0, targetCount, maxUniformBins);

            const eventSeconds = frameTimestamp ?? Date.now() / 1000;
            let uniformTime = baseUniformRef.current.time;
            if (frameTimestamp != null) {
                if (startTimestampRef.current == null) {
                    startTimestampRef.current = frameTimestamp;
                }
                uniformTime = frameTimestamp - startTimestampRef.current!;
                fallbackStartSecondsRef.current = null;
            } else {
                if (fallbackStartSecondsRef.current == null) {
                    fallbackStartSecondsRef.current = eventSeconds;
                }
                uniformTime = eventSeconds - fallbackStartSecondsRef.current!;
            }

            let frameIntervalMs = 0;
            if (lastFrameSecondsRef.current != null) {
                const deltaSeconds = Math.max(eventSeconds - lastFrameSecondsRef.current!, 1.0e-4);
                frameIntervalMs = deltaSeconds * 1000.0;
                const instantFps = 1.0 / deltaSeconds;
                fpsEstimateRef.current =
                    fpsEstimateRef.current > 0 ? fpsEstimateRef.current * 0.85 + instantFps * 0.15 : instantFps;
            }
            lastFrameSecondsRef.current = eventSeconds;

            applyUniforms((base) => {
                base.bins = bins;
                base.binCount = targetCount;
                base.amplitude = amplitude;
                base.time = uniformTime;
            });

            visualizerDiagnostics$.set({
                fps: Number.isFinite(fpsEstimateRef.current) ? fpsEstimateRef.current : 0,
                frameIntervalMs,
                tapDurationMs: processDurationMs,
                throttleMs,
                binCount: targetCount,
                updatedAt: Date.now(),
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
        jsiBindingsAvailable,
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
