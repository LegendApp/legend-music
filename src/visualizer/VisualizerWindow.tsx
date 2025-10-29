import { use$ } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Text, View } from "react-native";

import { Select, type SelectOption } from "@/components/Select";
import { localPlayerState$ } from "@/components/LocalAudioPlayer";
import { defaultVisualizerPresetId, getVisualizerPresetById, visualizerPresets } from "@/visualizer/presets";
import { visualizerPreferences$ } from "@/visualizer/preferences";

export default function VisualizerWindow() {
    const track = use$(localPlayerState$.currentTrack);
    const isPlaying = use$(localPlayerState$.isPlaying);
    const storedPresetId = use$(visualizerPreferences$.visualizer.selectedPresetId);
    const storedBinCount = use$(visualizerPreferences$.visualizer.binCount);
    const binCount = storedBinCount ?? 64;

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

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) {
            visualizerPreferences$.window.width.set(Math.round(width));
            visualizerPreferences$.window.height.set(Math.round(height));
        }
    }, []);

    return (
        <View className="flex-1 bg-slate-950/85" onLayout={handleLayout}>
            <View className="flex-1 p-6 gap-5">
                <View className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/40 gap-4">
                    <View className="flex-row flex-wrap items-end justify-between gap-4">
                        <View className="gap-1 flex-1 min-w-[220px]">
                            <Text className="text-xs uppercase tracking-[0.3em] text-white/40">Now Playing</Text>
                            <Text className="text-white text-xl font-semibold" numberOfLines={1}>
                                {track?.title ?? "Waiting for playback"}
                            </Text>
                            {trackSubtitle ? (
                                <Text className="text-white/60 text-sm" numberOfLines={1}>
                                    {trackSubtitle}
                                </Text>
                            ) : null}
                        </View>
                        <View className="flex-row gap-4 min-w-[200px] flex-wrap justify-end">
                            <View className="gap-2 min-w-[160px]">
                                <Text className="text-white/70 text-xs uppercase tracking-[0.25em]">Preset</Text>
                                <Select
                                    options={options}
                                    value={preset.id}
                                    onValueChange={handlePresetChange}
                                    triggerClassName="bg-white/10 border-white/15 h-10 px-3 rounded-xl"
                                    textClassName="text-white text-sm"
                                />
                            </View>
                            <View className="gap-2 min-w-[160px]">
                                <Text className="text-white/70 text-xs uppercase tracking-[0.25em]">
                                    Frequency Detail
                                </Text>
                                <Select
                                    options={binCountOptions}
                                    value={String(binCount)}
                                    onValueChange={handleBinCountChange}
                                    triggerClassName="bg-white/10 border-white/15 h-10 px-3 rounded-xl"
                                    textClassName="text-white text-sm"
                                />
                            </View>
                        </View>
                    </View>
                </View>

                <View className="flex-1 rounded-3xl border border-white/10 bg-black/40 overflow-hidden relative">
                    <PresetComponent style={{ flex: 1 }} binCountOverride={binCount} />
                    {!isPlaying ? (
                        <View className="absolute inset-0 items-center justify-center pointer-events-none">
                            <Text className="text-white/40 text-sm">Start playback to animate the visualizer</Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </View>
    );
}
