import type { Observable } from "@legendapp/state";
import { use$, useObservable, useObserveEffect } from "@legendapp/state/react";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { perfCount, perfLog } from "@/utils/perfLogger";

interface CustomSliderProps {
    value?: number | undefined;
    $value: Observable<number>;
    minimumValue: number;
    $maximumValue: Observable<number>;
    onSlidingComplete?: (value: number) => void;
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
    disabled = false,
    style,
    minimumTrackTintColor = "#ffffff",
    maximumTrackTintColor = "#ffffff40",
}: CustomSliderProps) {
    const isDragging$ = useObservable(false);
    const isHovered$ = useObservable(false);
    const isHovered = use$(isHovered$);

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
        thumbHeight.value = withTiming(isHovered ? 12 : 1, { duration: 150 });
    }, [isHovered]);

    const handlePress = (event: any) => {
        perfLog("CustomSlider.handlePress", { disabled });
        if (disabled) return;

        const { locationX } = event.nativeEvent;
        const sliderWidth = 300; // Approximate width, could be measured dynamically
        const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
        const newValue = minimumValue + percentage * ($maximumValue.get() - minimumValue);

        perfLog("CustomSlider.handlePress", { locationX, sliderWidth, percentage, newValue });
        $value.set(newValue);
        onSlidingComplete?.(newValue);
    };

    const handlePressIn = () => {
        perfLog("CustomSlider.handlePressIn", { disabled });
        if (disabled) return;
        isDragging$.set(true);
    };

    const handlePressOut = () => {
        perfLog("CustomSlider.handlePressOut", { disabled });
        if (disabled) return;
        isDragging$.set(false);
        onSlidingComplete?.($value.get());
    };

    const handleHoverIn = () => {
        perfLog("CustomSlider.handleHoverIn", { disabled });
        if (disabled) return;
        isHovered$.set(true);
    };

    const handleHoverOut = () => {
        perfLog("CustomSlider.handleHoverOut", { disabled });
        if (disabled) return;
        isHovered$.set(false);
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
        <View style={[{ height: 40 }, style]}>
            <Pressable
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onHoverIn={handleHoverIn}
                onHoverOut={handleHoverOut}
                disabled={disabled}
                className="flex-1 justify-center"
            >
                <View className="h-1 bg-white/20 rounded-full">
                    {/* Progress track */}
                    <Animated.View className="h-full rounded-full" style={trackAnimatedStyle} />
                    {/* Vertical line thumb */}
                    <Animated.View
                        className="absolute w-0.5 bg-white"
                        style={[
                            thumbAnimatedStyle,
                            trackAnimatedStyle,
                            {
                                marginTop: 2,
                                marginLeft: -1, // Half of line width
                                opacity: disabled ? 0.5 : isHovered ? 1 : 0,
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
