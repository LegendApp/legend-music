import { use$ } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Pressable, Text, View } from "react-native";

import { VisualizerCanvas, type VisualizerMode } from "@/components/Visualizer/VisualizerCanvas";
import { localPlayerState$ } from "@/components/LocalAudioPlayer";
import { cn } from "@/utils/cn";
import { visualizerPreferences$ } from "@/visualizer/preferences";

const BIN_OPTIONS = [32, 48, 64, 96, 128];
const SMOOTHING_OPTIONS = [0.4, 0.6, 0.75];

const clampIndex = (value: number, length: number) => {
    if (length === 0) {
        return 0;
    }
    if (value < 0) {
        return length - 1;
    }
    if (value >= length) {
        return 0;
    }
    return value;
};

const nextSmoothing = (current: number) => {
    const index = SMOOTHING_OPTIONS.indexOf(Number(current.toFixed(2)));
    const nextIndex = clampIndex(index + 1, SMOOTHING_OPTIONS.length);
    return SMOOTHING_OPTIONS[nextIndex];
};

const nextBinCount = (current: number) => {
    const index = BIN_OPTIONS.indexOf(current);
    const nextIndex = clampIndex(index + 1, BIN_OPTIONS.length);
    return BIN_OPTIONS[nextIndex];
};

const formatArtist = (artist?: string | null) => {
    if (!artist) {
        return "";
    }
    return artist;
};

const computeFftSize = (binCount: number) => {
    const minimum = Math.max(256, binCount * 16);
    const power = Math.ceil(Math.log2(minimum));
    return Math.pow(2, power);
};

type ToggleButtonProps = {
    label: string;
    subtitle?: string;
    active?: boolean;
    onPress: () => void;
};

const ToggleButton = ({ label, subtitle, active, onPress }: ToggleButtonProps) => (
    <Pressable
        onPress={onPress}
        className={cn(
            "px-3 py-2 rounded-xl border",
            active ? "bg-emerald-500/20 border-emerald-400/60" : "bg-white/10 border-white/15",
        )}
    >
        <Text className={cn("text-sm font-medium", active ? "text-emerald-200" : "text-white/80")}>{label}</Text>
        {subtitle ? <Text className="text-xs text-white/50 mt-0.5">{subtitle}</Text> : null}
    </Pressable>
);

type ModeSwitchProps = {
    value: VisualizerMode;
    onChange: (mode: VisualizerMode) => void;
};

const ModeSwitch = ({ value, onChange }: ModeSwitchProps) => (
    <View className="flex-row rounded-xl border border-white/15 overflow-hidden">
        {(["spectrum", "waveform"] as const).map((mode) => (
            <Pressable
                key={mode}
                onPress={() => onChange(mode)}
                className={cn(
                    "px-3 py-2 flex-1 items-center",
                    value === mode ? "bg-white/20" : "bg-white/5",
                )}
            >
                <Text className={cn("text-sm font-medium", value === mode ? "text-white" : "text-white/70")}
                    >
                    {mode === "spectrum" ? "Spectrum" : "Waveform"}
                </Text>
            </Pressable>
        ))}
    </View>
);

export function VisualizerWindow() {
    const track = use$(localPlayerState$.currentTrack);
    const isPlaying = use$(localPlayerState$.isPlaying);

    const mode = use$(visualizerPreferences$.visualizer.mode);
    const binCount = use$(visualizerPreferences$.visualizer.binCount);
    const smoothing = use$(visualizerPreferences$.visualizer.smoothing);
    const fftSize = use$(visualizerPreferences$.visualizer.fftSize);
    const throttleMs = use$(visualizerPreferences$.visualizer.throttleMs);
    const autoClose = use$(visualizerPreferences$.window.autoClose);

    const trackSubtitle = useMemo(() => {
        if (!track) {
            return "";
        }
        const artist = formatArtist(track.artist);
        const album = track.album ? ` • ${track.album}` : "";
        return `${artist}${album}`.trim();
    }, [track]);

    const handleModeChange = useCallback(
        (nextMode: VisualizerMode) => {
            visualizerPreferences$.visualizer.mode.set(nextMode);
        },
        [],
    );

    const handleCycleBinCount = useCallback(() => {
        const next = nextBinCount(binCount);
        visualizerPreferences$.visualizer.binCount.set(next);
        visualizerPreferences$.visualizer.fftSize.set(computeFftSize(next));
    }, [binCount]);

    const handleCycleSmoothing = useCallback(() => {
        const next = nextSmoothing(smoothing);
        visualizerPreferences$.visualizer.smoothing.set(next);
    }, [smoothing]);

    const handleToggleAutoClose = useCallback(() => {
        visualizerPreferences$.window.autoClose.set(!autoClose);
    }, [autoClose]);

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
                <View className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/40">
                    <Text className="text-xs uppercase tracking-[0.3em] text-white/40">Now Playing</Text>
                    <Text className="text-white text-xl font-semibold mt-1" numberOfLines={1}>
                        {track?.title ?? "Waiting for playback"}
                    </Text>
                    {trackSubtitle ? (
                        <Text className="text-white/60 text-sm mt-1" numberOfLines={1}>
                            {trackSubtitle}
                        </Text>
                    ) : null}

                    <View className="flex-row flex-wrap gap-3 mt-4">
                        <ModeSwitch value={mode} onChange={handleModeChange} />
                        <ToggleButton
                            label={`Bins ${binCount}`}
                            subtitle="Tap to cycle"
                            onPress={handleCycleBinCount}
                        />
                        <ToggleButton
                            label={`Smooth ${Math.round(smoothing * 100)}%`}
                            subtitle="Tap to cycle"
                            onPress={handleCycleSmoothing}
                        />
                        <ToggleButton
                            label="Auto-close"
                            subtitle={autoClose ? "Enabled" : "Disabled"}
                            active={autoClose}
                            onPress={handleToggleAutoClose}
                        />
                    </View>
                </View>

                <View className="flex-1 rounded-3xl border border-white/10 bg-black/40 overflow-hidden relative">
                    <VisualizerCanvas
                        style={{ flex: 1 }}
                        mode={mode}
                        binCount={binCount}
                        fftSize={fftSize}
                        smoothing={smoothing}
                        throttleMs={throttleMs}
                    />
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

export default VisualizerWindow;
