import type { Observable } from "@legendapp/state";
import { Memo, useObservable } from "@legendapp/state/react";
import { memo } from "react";
import { type LayoutChangeEvent, Text, View } from "react-native";
import type { OverlayPlaybackMode } from "@/components/PlaybackArea";
import { PlaybackTimelineSlider } from "@/components/PlaybackTimelineSlider";
import { cn } from "@/utils/cn";

type PlaybackTimelineProps = {
    currentLocalTime$: Observable<number>;
    duration$: Observable<number>;
    disabled?: boolean;
    overlayMode?: OverlayPlaybackMode;
    onLayout?: (event: LayoutChangeEvent) => void;
    onSlidingChange?: (value: number) => void;
    onSlidingComplete?: (value: number) => void;
    onSlidingStart?: () => void;
    onSlidingEnd?: (value: number) => void;
};

const formatTimeCache = new Map<number, string>();

// const SkiaTextOnHover = memo(function SkiaTextOnHover({
//     text$,
//     align,
// }: {
//     text$: Observable<string>;
//     align?: SkiaTextProps["align"];
//     overlayMode: boolean;
// }) {
//     const visible = useValue(state$.isWindowHovered);

//     return (
//         <AnimatePresence>
//             {visible ? (
//                 <Motion.View
//                     initial={{ opacity: 0 }}
//                     animate={{ opacity: 1 }}
//                     exit={{ opacity: 0 }}
//                     transition={{
//                         opacity: {
//                             type: "timing",
//                             duration: 100,
//                         },
//                     }}
//                 >
//                     <SkiaText text$={text$} fontSize={10} color="#ffffffb3" align={align} />
//                 </Motion.View>
//             ) : null}
//         </AnimatePresence>
//     );
// });

// const TextOnHover = memo(function SkiaTextOnHover({
//     text$,
//     align,
//     overlayMode = false,
// }: {
//     text$: Observable<string>;
//     align?: SkiaTextProps["align"];
//     overlayMode: boolean;
// }) {
//     // const visible = useValue(state$.isWindowHovered);
//     const visible = true; // useValue(state$.isWindowHovered);

//     return (
//         <AnimatePresence>
//             {overlayMode || visible ? (
//                 <Motion.View
//                     initial={{ opacity: 0 }}
//                     animate={{ opacity: 1 }}
//                     exit={{ opacity: 0 }}
//                     transition={{
//                         opacity: {
//                             type: "timing",
//                             duration: 100,
//                         },
//                     }}
//                 >
//                     <Text className="text-[11px] text-text-primary font-bold" style={{ fontVariant: ["tabular-nums"] }}>
//                         <Memo>{text$}</Memo>
//                     </Text>
//                 </Motion.View>
//             ) : null}
//         </AnimatePresence>
//     );
// });

const Text$ = memo(function Text$({ text$ }: { text$: Observable<string> }) {
    return (
        <Text className="text-[11px] text-text-secondary" style={{ fontVariant: ["tabular-nums"] }}>
            <Memo>{text$}</Memo>
        </Text>
    );
});

export const CurrentTime = memo(function CurrentTime({ time$ }: { time$: Observable<number> }) {
    const formattedTime$ = useObservable(() => formatTime(time$.get?.() ?? 0, false));

    return <Text$ text$={formattedTime$} />;
});

const Duration = memo(function Duration({ duration$ }: { duration$: Observable<number> }) {
    const formattedTime$ = useObservable(() => formatTime(duration$.get?.() ?? 0, true));

    return <Text$ text$={formattedTime$} />;
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
    onSlidingChange,
    onSlidingComplete,
    onSlidingStart,
    onSlidingEnd,
}: PlaybackTimelineProps) {
    return (
        <View
            className={cn("flex flex-row gap-2 items-center h-5", disabled && "opacity-0")}
            onLayout={onLayout}
            mouseDownCanMoveWindow={false}
        >
            <CurrentTime time$={currentLocalTime$} />
            <PlaybackTimelineSlider
                style={{ height: 14, flex: 1 }}
                minimumValue={0}
                $maximumValue={duration$}
                $value={currentLocalTime$}
                onSlidingChange={onSlidingChange}
                onSlidingStart={onSlidingStart}
                onSlidingComplete={onSlidingComplete}
                onSlidingEnd={onSlidingEnd}
                minimumTrackTintColor="#ffffff"
                maximumTrackTintColor="#ffffff40"
                disabled={disabled}
            />
            <Duration duration$={duration$} />
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
