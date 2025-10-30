import { use$ } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import type { LayoutChangeEvent } from "react-native";
import { PortalProvider } from "@gorhom/portal";
import { Switch, Text, View } from "react-native";

import { localPlayerState$ } from "@/components/LocalAudioPlayer";
import { Select, type SelectOption } from "@/components/Select";
import { TooltipProvider } from "@/components/TooltipProvider";
import { visualizerDiagnostics$ } from "@/visualizer/diagnostics";
import { visualizerPreferences$ } from "@/visualizer/preferences";
import { defaultVisualizerPresetId, getVisualizerPresetById, visualizerPresets } from "@/visualizer/presets";

export default function VisualizerWindow() {
    const track = use$(localPlayerState$.currentTrack);
    const isPlaying = use$(localPlayerState$.isPlaying);
    const storedPresetId = use$(visualizerPreferences$.visualizer.selectedPresetId);
    const storedBinCount = use$(visualizerPreferences$.visualizer.binCount);
    const binCount = storedBinCount ?? 64;
    const debugOverlayEnabled = use$(visualizerPreferences$.visualizer.debugOverlay);
    const showDebugOverlay = debugOverlayEnabled ?? false;
    const diagnostics = use$(visualizerDiagnostics$);

    const formatMetric = (value: number, digits: number) => (value > 0 ? value.toFixed(digits) : "--");

    const preset = useMemo(() => {
        const fallbackId = defaultVisualizerPresetId;
        const activeId = storedPresetId || fallbackId;
        return getVisualizerPresetById(activeId);
    }, [storedPresetId]);

    const PresetComponent = preset.Component;

    const trackSubtitle = useMemo(() => {
        if (!track) {
            return "";
        }
        const segments: string[] = [];
        if (track.artist) {
            segments.push(track.artist);
        }
        if (track.album) {
            segments.push(track.album);
        }
        return segments.join(" • ");
    }, [track]);

    const options = useMemo(
        () => visualizerPresets.map((definition) => ({ label: definition.name, value: definition.id })),
        [],
    );

    const binCountOptions = useMemo<SelectOption[]>(
        () => [
            { label: "16 bins", value: "16" },
            { label: "32 bins", value: "32" },
            { label: "64 bins", value: "64" },
            { label: "128 bins", value: "128" },
        ],
        [],
    );

    const handlePresetChange = useCallback((value: string) => {
        visualizerPreferences$.visualizer.selectedPresetId.set(value);
    }, []);

    const handleBinCountChange = useCallback((value: string) => {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
            visualizerPreferences$.visualizer.binCount.set(parsed);
        }
    }, []);

    const handleDebugToggle = useCallback((value: boolean) => {
        visualizerPreferences$.visualizer.debugOverlay.set(value);
    }, []);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
            visualizerPreferences$.window.width.set(Math.round(width));
            visualizerPreferences$.window.height.set(Math.round(height));
        }
    }, []);

    return (
        <PortalProvider>
            <TooltipProvider>
                <View className="flex-1 bg-slate-950" onLayout={handleLayout}>
                    <View className="flex-1">
                        <PresetComponent style={{ flex: 1 }} binCountOverride={binCount} />
                    </View>
                    {!isPlaying ? (
                        <View className="absolute inset-0 items-center justify-center pointer-events-none">
                            <Text className="text-white/40 text-sm">Start playback to animate the visualizer</Text>
                        </View>
                    ) : null}
                    <View pointerEvents="box-none" className="absolute inset-0 flex-row">
                        <View className="ml-auto p-6 pointer-events-auto max-w-xl gap-5">
                            <View className="gap-4">
                                <View className="flex-row flex-wrap items-end justify-between gap-4">
                                    <View className="gap-1 flex-1 min-w-[220px]">
                                        <Text className="text-white text-xl font-semibold" numberOfLines={1}>
                                            {track?.title ?? "Waiting for playback"}
                                        </Text>
                                        {trackSubtitle ? (
                                            <Text className="text-white text-sm" numberOfLines={1}>
                                                {trackSubtitle}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View className="flex-row gap-4 min-w-[200px] flex-wrap justify-end">
                                        <View className="gap-2 min-w-[160px]">
                                            <Text className="text-white text-xs uppercase tracking-[0.25em]">
                                                Preset
                                            </Text>
                                            <Select
                                                options={options}
                                                value={preset.id}
                                                onValueChange={handlePresetChange}
                                                triggerClassName="bg-black/60 border-white/25 h-10 px-3 rounded-xl"
                                                textClassName="text-white text-sm"
                                            />
                                        </View>
                                        <View className="gap-2 min-w-[160px]">
                                            <Text className="text-white text-xs uppercase tracking-[0.25em]">
                                                Frequency Detail
                                            </Text>
                                            <Select
                                                options={binCountOptions}
                                                value={String(binCount)}
                                                onValueChange={handleBinCountChange}
                                                triggerClassName="bg-black/60 border-white/25 h-10 px-3 rounded-xl"
                                                textClassName="text-white text-sm"
                                            />
                                        </View>
                                        <View className="gap-2 min-w-[160px]">
                                            <Text className="text-white text-xs uppercase tracking-[0.25em]">
                                                Debug Overlay
                                            </Text>
                                            <View className="bg-black/60 border border-white/25 h-10 px-3 rounded-xl flex-row items-center justify-between">
                                                <Text className="text-white text-sm">
                                                    {showDebugOverlay ? "Enabled" : "Disabled"}
                                                </Text>
                                                <Switch
                                                    value={showDebugOverlay}
                                                    onValueChange={handleDebugToggle}
                                                    trackColor={{ false: "#1e293b", true: "#22c55e" }}
                                                    thumbColor="#f8fafc"
                                                />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                    {showDebugOverlay ? (
                        <View className="absolute top-6 left-6 bg-black/60 border border-white/10 rounded-xl px-4 py-3 gap-1 pointer-events-none">
                            <Text className="text-white/60 text-[11px] uppercase tracking-[0.25em]">Diagnostics</Text>
                            <Text className="text-white text-sm">
                                FPS {formatMetric(diagnostics.fps, 1)} • Interval{" "}
                                {formatMetric(diagnostics.frameIntervalMs, 2)} ms
                            </Text>
                            <Text className="text-white/80 text-sm">
                                Tap {formatMetric(diagnostics.tapDurationMs, 2)} ms • Throttle{" "}
                                {formatMetric(diagnostics.throttleMs, 1)} ms
                            </Text>
                            <Text className="text-white/60 text-xs">Bins {diagnostics.binCount}</Text>
                        </View>
                    ) : null}
                </View>
            </TooltipProvider>
        </PortalProvider>
    );
}
