import type { Observable } from "@legendapp/state";
import { use$, useObservable, useObserveEffect } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import { PanResponder, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useObservableLatest } from "@/observables/useObservableLatest";
import { perfCount, perfLog } from "@/utils/perfLogger";

interface CustomSliderProps {
    value?: number | undefined;
    $value: Observable<number>;
    minimumValue: number;
    $maximumValue: Observable<number>;
    onSlidingComplete?: (value: number) => void;
    onHoverChange?: (hovered: boolean) => void;
    disabled?: boolean;
    style?: any;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
}

export function CustomSlider({
    $value,
    minimumValue,
    $maximumValue,
    onSlidingComplete,
    onHoverChange,
    disabled: disabledProp = false,
    style,
    minimumTrackTintColor = "#ffffff",
    maximumTrackTintColor = "#ffffff40",
}: CustomSliderProps) {
    const isDragging$ = useObservable(false);
    const isHovered$ = useObservable(false);
    const isHovered = use$(isHovered$);
    const isDragging = use$(isDragging$);
    const [sliderWidth, setSliderWidth] = useState(0);
    const isDisabled$ = useObservableLatest(disabledProp);
    const isDisabled = use$(isDisabled$);

    // Calculate progress percentage
    const progress$ = useObservableSharedValue(() => {
        perfCount("CustomSlider.computeProgress");
        const value = $value.get();
        const maximumValue = $maximumValue.get();
        const progress = maximumValue > minimumValue ? (value - minimumValue) / (maximumValue - minimumValue) : 0;
        perfLog("CustomSlider.computeProgress", { value, maximumValue, progress });
        return progress;
    });

    // Animated value for thumb height
    const thumbHeight = useSharedValue(1);

    // Animate thumb height based on hover state
    useEffect(() => {
        thumbHeight.value = withTiming(isHovered || isDragging ? 12 : 1, { duration: 150 });
    }, [isDragging, isHovered]);

    const updateValueFromLocation = useCallback(
        (locationX: number) => {
            if (sliderWidth <= 0) {
                return;
            }

            const maximumValue = $maximumValue.get();
            const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
            const newValue = minimumValue + percentage * (maximumValue - minimumValue);

            perfLog("CustomSlider.updateValueFromLocation", {
                locationX,
                sliderWidth,
                percentage,
                newValue,
            });

            $value.set(newValue);
            onSlidingComplete?.(newValue);
        },
        [$maximumValue, $value, minimumValue, onSlidingComplete, sliderWidth],
    );

    const handleTrackLayout = (event: LayoutChangeEvent) => {
        setSliderWidth(event.nativeEvent.layout.width);
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => !isDisabled$.get(),
                onMoveShouldSetPanResponder: () => !isDisabled$.get(),
                onPanResponderGrant: (event: GestureResponderEvent) => {
                    perfLog("CustomSlider.panGrant", { disabled: isDisabled$.get() });
                    if (isDisabled$.get()) return;

                    isDragging$.set(true);
                    updateValueFromLocation(event.nativeEvent.locationX);
                },
                onPanResponderMove: (event: GestureResponderEvent) => {
                    if (isDisabled$.get() || !isDragging$.get()) {
                        return;
                    }

                    updateValueFromLocation(event.nativeEvent.locationX);
                },
                onPanResponderRelease: (event: GestureResponderEvent) => {
                    perfLog("CustomSlider.panRelease", { disabled: isDisabled$.get() });
                    if (isDisabled$.get()) return;

                    updateValueFromLocation(event.nativeEvent.locationX);
                    isDragging$.set(false);
                },
                onPanResponderTerminationRequest: () => false,
                onPanResponderTerminate: () => {
                    perfLog("CustomSlider.panTerminate", { disabled: isDisabled$.get() });
                    isDragging$.set(false);
                },
            }),
        [isDisabled$, isDragging$, updateValueFromLocation],
    );

    const handleHoverIn = () => {
        perfLog("CustomSlider.handleHoverIn", { disabled: isDisabled$.get() });
        if (isDisabled$.get()) {
            onHoverChange?.(false);
            return;
        }
        isHovered$.set(true);
        onHoverChange?.(true);
    };

    const handleHoverOut = () => {
        perfLog("CustomSlider.handleHoverOut", { disabled: isDisabled$.get() });
        if (isDisabled$.get()) {
            onHoverChange?.(false);
            return;
        }
        isHovered$.set(false);
        onHoverChange?.(false);
    };

    const handlePress = (event: GestureResponderEvent) => {
        perfLog("CustomSlider.handlePress", { disabled: isDisabled$.get() });
        if (isDisabled$.get()) return;
        updateValueFromLocation(event.nativeEvent.locationX);
    };

    // Animated style for the thumb
    const thumbAnimatedStyle = useAnimatedStyle(() => {
        const height = thumbHeight.value;
        return {
            height: height,
            top: -height / 2, // Center the line by moving it up by half its height
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
                onPress={handlePress}
                disabled={isDisabled}
                className="flex-1 justify-center"
            >
                <View
                    onLayout={handleTrackLayout}
                    className="h-1 bg-white/20 rounded-full"
                    style={{ backgroundColor: maximumTrackTintColor }}
                >
                    {/* Progress track */}
                    <Animated.View className="h-full rounded-full" style={trackAnimatedStyle} />
                    {/* Vertical line thumb */}
                    <Animated.View
                        className="absolute w-0.5 bg-white"
                        style={[
                            thumbAnimatedStyle,
                            {
                                marginTop: 2,
                                marginLeft: -1, // Half of line width
                                opacity: isDisabled ? 0.5 : isHovered || isDragging ? 1 : 0,
                            },
                        ]}
                    />
                </View>
            </Pressable>
        </View>
    );
}

export function useObservableSharedValue<T>(compute: () => T) {
    const sharedValue = useSharedValue(compute());

    useObserveEffect(() => {
        sharedValue.value = compute();
    });

    return sharedValue;
}
