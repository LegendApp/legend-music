import { AnimatePresence, Motion } from "@legendapp/motion";
import type { Observable } from "@legendapp/state";
import { Memo, useObservable, useValue } from "@legendapp/state/react";
import { memo } from "react";
import { type LayoutChangeEvent, Text, View } from "react-native";
import { CustomSlider } from "@/components/CustomSlider";
import type { OverlayPlaybackMode } from "@/components/PlaybackArea";
import { SkiaText, type SkiaTextProps } from "@/components/SkiaText";
import { state$ } from "@/systems/State";
import { cn } from "@/utils/cn";

type PlaybackTimelineProps = {
    currentLocalTime$: Observable<number>;
    duration$: Observable<number>;
    disabled?: boolean;
    overlayMode?: OverlayPlaybackMode;
    onLayout?: (event: LayoutChangeEvent) => void;
    onSlidingComplete?: (value: number) => void;
    onSlidingStart?: () => void;
    onSlidingEnd?: () => void;
};

const formatTimeCache = new Map<number, string>();

const SkiaTextOnHover = memo(function SkiaTextOnHover({
    text$,
    align,
}: {
    text$: Observable<string>;
    align?: SkiaTextProps["align"];
    overlayMode: boolean;
}) {
    const visible = useValue(state$.isWindowHovered);

    return (
        <AnimatePresence>
            {visible ? (
                <Motion.View
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                        opacity: {
                            type: "timing",
                            duration: 100,
                        },
                    }}
                >
                    <SkiaText text$={text$} fontSize={10} color="#ffffffb3" align={align} />
                </Motion.View>
            ) : null}
        </AnimatePresence>
    );
});

const TextOnHover = memo(function SkiaTextOnHover({
    text$,
    align,
    overlayMode = false,
}: {
    text$: Observable<string>;
    align?: SkiaTextProps["align"];
    overlayMode: boolean;
}) {
    const visible = useValue(state$.isWindowHovered);

    return (
        <AnimatePresence>
            {overlayMode || visible ? (
                <Motion.View
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                        opacity: {
                            type: "timing",
                            duration: 100,
                        },
                    }}
                >
                    <Text className="text-[11px]" style={{ fontVariant: ["tabular-nums"] }}>
                        <Memo>{text$}</Memo>
                    </Text>
                </Motion.View>
            ) : null}
        </AnimatePresence>
    );
});

const CurrentTime = memo(function CurrentTime({
    currentLocalTime$,
    duration$,
    overlayMode = false,
}: {
    currentLocalTime$: Observable<number>;
    duration$: Observable<number>;
    overlayMode: boolean;
}) {
    const formattedTime$ = useObservable(
        () => `${formatTime(currentLocalTime$.get?.() ?? 0, false)} / ${formatTime(duration$.get?.() ?? 0, true)}`,
    );

    return <TextOnHover text$={formattedTime$} overlayMode={overlayMode} />;
});

// const CurrentDuration = memo(function CurrentDuration({ duration$ }: { duration$: Observable<number> }) {
//     const durationText$ = useObservable(() => formatTime(duration$.get?.() ?? 0, true));

//     return <SkiaTextOnHover text$={durationText$} align="right" />;
// });

export function PlaybackTimeline({
    currentLocalTime$,
    duration$,
    disabled = false,
    overlayMode = undefined,
    onLayout,
    onSlidingComplete,
    onSlidingStart,
    onSlidingEnd,
}: PlaybackTimelineProps) {
    return (
        <View className={cn("pb-1", disabled && "opacity-0")} onLayout={onLayout} mouseDownCanMoveWindow={false}>
            <View className="absolute right-0 -top-2 flex-row items-center" pointerEvents="none">
                <CurrentTime currentLocalTime$={currentLocalTime$} duration$={duration$} overlayMode={!!overlayMode} />
            </View>
            <CustomSlider
                style={{ height: 24, width: "100%" }}
                minimumValue={0}
                $maximumValue={duration$}
                $value={currentLocalTime$}
                onSlidingStart={onSlidingStart}
                onSlidingComplete={onSlidingComplete}
                onSlidingEnd={onSlidingEnd}
                minimumTrackTintColor="#ffffff"
                maximumTrackTintColor="#ffffff40"
                disabled={disabled}
            />
        </View>
    );
}

function formatTime(seconds: number, cache?: boolean): string {
    const roundedSeconds = Math.floor(seconds);

    if (cache && formatTimeCache.has(roundedSeconds)) {
        return formatTimeCache.get(roundedSeconds)!;
    }

    const mins = Math.floor(roundedSeconds / 60);
    const secs = roundedSeconds % 60;
    const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;

    if (cache) {
        if (formatTimeCache.size > 1000) {
            formatTimeCache.clear();
        }
        formatTimeCache.set(roundedSeconds, formatted);
    }

    return formatted;
}
