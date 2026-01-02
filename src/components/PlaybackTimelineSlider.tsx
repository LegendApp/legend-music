import { Motion } from "@legendapp/motion";
import type { Observable } from "@legendapp/state";
import { useObservable, useObserveEffect, useValue } from "@legendapp/state/react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import { PanResponder, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useObservableLatest } from "@/observables/useObservableLatest";
import { Transitions } from "@/systems/constants";
import { perfCount, perfLog } from "@/utils/perfLogger";

interface PlaybackTimelineSliderProps {
    value?: number | undefined;
    $value: Observable<number>;
    minimumValue: number;
    $maximumValue: Observable<number>;
    onSlidingChange?: (value: number) => void;
    onSlidingComplete?: (value: number) => void;
    onSlidingStart?: () => void;
    onSlidingEnd?: (value: number) => void;
    onHoverChange?: (hovered: boolean) => void;
    disabled?: boolean;
    style?: any;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
}

export function PlaybackTimelineSlider({
    $value,
    minimumValue,
    $maximumValue,
    onSlidingChange,
    onSlidingComplete,
    onSlidingStart,
    onSlidingEnd,
    onHoverChange,
    disabled: disabledProp = false,
    style,
    minimumTrackTintColor = "#ffffff",
    maximumTrackTintColor = "#ffffff40",
}: PlaybackTimelineSliderProps) {
    const isDragging$ = useObservable(false);
    const isHovered$ = useObservable(false);
    const isHovered = useValue(isHovered$);
    const isDragging = useValue(isDragging$);
    const [sliderWidth, setSliderWidth] = useState(0);
    const isDisabled$ = useObservableLatest(disabledProp);
    const isDisabled = useValue(isDisabled$);
    const lastCommittedValueRef = useRef<number | null>(null);

    // Calculate progress percentage
    const progress$ = useObservableSharedValue(() => {
        perfCount("PlaybackTimelineSlider.computeProgress");
        const value = $value.get();
        const maximumValue = $maximumValue.get();
        const progress = maximumValue > minimumValue ? (value - minimumValue) / (maximumValue - minimumValue) : 0;
        perfLog("PlaybackTimelineSlider.computeProgress", { value, maximumValue, progress });
        return progress;
    });

    // Animated value for thumb height
    const thumbHeight = useSharedValue(1);

    // Animate thumb height based on hover state
    useObserveEffect(() => {
        const hovered = isHovered$.get();
        const dragging = isDragging$.get();
        thumbHeight.set(withTiming(hovered || dragging ? 12 : 1, { duration: 150 }));
    });

    const updateValueFromLocation = useCallback(
        (locationX: number) => {
            if (sliderWidth <= 0) {
                return null;
            }

            const maximumValue = $maximumValue.get();
            const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
            const newValue = minimumValue + percentage * (maximumValue - minimumValue);

            perfLog("PlaybackTimelineSlider.updateValueFromLocation", {
                locationX,
                sliderWidth,
                percentage,
                newValue,
            });

            $value.set(newValue);

            if (newValue !== lastCommittedValueRef.current) {
                onSlidingChange?.(newValue);
                lastCommittedValueRef.current = newValue;
            }

            return newValue;
        },
        [$maximumValue, $value, minimumValue, onSlidingChange, sliderWidth],
    );

    const handleTrackLayout = (event: LayoutChangeEvent) => {
        setSliderWidth(event.nativeEvent.layout.width);
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => !isDisabled$.get(),
                onStartShouldSetPanResponderCapture: () => !isDisabled$.get(),
                onMoveShouldSetPanResponder: () => !isDisabled$.get(),
                onMoveShouldSetPanResponderCapture: () => !isDisabled$.get(),
                onPanResponderGrant: (event: GestureResponderEvent) => {
                    perfLog("PlaybackTimelineSlider.panGrant", { disabled: isDisabled$.get() });
                    if (isDisabled$.get()) return;

                    lastCommittedValueRef.current = null;
                    isDragging$.set(true);
                    onSlidingStart?.();
                    updateValueFromLocation(event.nativeEvent.locationX);
                },
                onPanResponderMove: (event: GestureResponderEvent) => {
                    if (isDisabled$.get() || !isDragging$.get()) {
                        return;
                    }

                    updateValueFromLocation(event.nativeEvent.locationX);
                },
                onPanResponderRelease: (event: GestureResponderEvent) => {
                    perfLog("PlaybackTimelineSlider.panRelease", { disabled: isDisabled$.get() });
                    if (isDisabled$.get()) return;

                    const nextValue = updateValueFromLocation(event.nativeEvent.locationX);
                    isDragging$.set(false);
                    if (typeof nextValue === "number") {
                        onSlidingEnd?.(nextValue);
                        onSlidingComplete?.(nextValue);
                    }
                },
                onPanResponderTerminationRequest: () => false,
                onPanResponderTerminate: (event: GestureResponderEvent) => {
                    perfLog("PlaybackTimelineSlider.panTerminate", { disabled: isDisabled$.get() });
                    if (isDisabled$.get()) return;

                    const nextValue = updateValueFromLocation(event.nativeEvent.locationX);
                    isDragging$.set(false);
                    if (typeof nextValue === "number") {
                        onSlidingEnd?.(nextValue);
                        onSlidingComplete?.(nextValue);
                    }
                },
            }),
        [isDisabled$, isDragging$, onSlidingComplete, onSlidingEnd, onSlidingStart, updateValueFromLocation],
    );

    const handleHoverIn = () => {
        perfLog("PlaybackTimelineSlider.handleHoverIn", { disabled: isDisabled$.get() });
        if (isDisabled$.get()) {
            onHoverChange?.(false);
            return;
        }
        isHovered$.set(true);
        onHoverChange?.(true);
    };

    const handleHoverOut = () => {
        perfLog("PlaybackTimelineSlider.handleHoverOut", { disabled: isDisabled$.get() });
        if (isDisabled$.get()) {
            onHoverChange?.(false);
            return;
        }
        isHovered$.set(false);
        onHoverChange?.(false);
    };

    // Animated style for the thumb
    const thumbAnimatedStyle = useAnimatedStyle(() => {
        const height = thumbHeight.value;
        return {
            height: height,
            top: -height / 4, // Center the line by moving it up by 1/4 its height
            left: `${progress$.value * 100}%`,
        };
    });

    const trackAnimatedStyle = useAnimatedStyle(() => {
        return {
            backgroundColor: minimumTrackTintColor,
            width: `${progress$.value * 100}%`,
        };
    });

    return (
        <View style={[{ height: 40 }, style]} {...panResponder.panHandlers}>
            <Pressable
                onHoverIn={handleHoverIn}
                onHoverOut={handleHoverOut}
                disabled={isDisabled}
                className="flex-1 justify-center"
            >
                <Motion.View
                    onLayout={handleTrackLayout}
                    className="bg-white/20 rounded-full"
                    style={{ backgroundColor: maximumTrackTintColor }}
                    animate={{ height: isHovered ? 8 : 3 }}
                    transition={Transitions.Spring}
                >
                    {/* Progress track */}
                    <Animated.View className="h-full rounded-l-full" style={trackAnimatedStyle} />
                    {/* Vertical line thumb */}
                    {/* <Animated.View
                        className="absolute w-1 bg-white rounded-full"
                        style={[
                            thumbAnimatedStyle,
                            {
                                marginTop: -3,
                                height: 100,
                                marginLeft: -4,
                                opacity: isDisabled ? 0.5 : isHovered || isDragging ? 1 : 0,
                            },
                        ]}
                    /> */}
                </Motion.View>
            </Pressable>
        </View>
    );
}

export function useObservableSharedValue<T>(compute: () => T) {
    const sharedValue = useSharedValue(compute());

    useObserveEffect(() => {
        sharedValue.set(compute());
    });

    return sharedValue;
}
