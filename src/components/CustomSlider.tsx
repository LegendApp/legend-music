import { use$, useObservable } from "@legendapp/state/react";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

interface CustomSliderProps {
    value: number;
    minimumValue: number;
    maximumValue: number;
    onSlidingComplete?: (value: number) => void;
    disabled?: boolean;
    style?: any;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
}

export function CustomSlider({
    value,
    minimumValue,
    maximumValue,
    onSlidingComplete,
    disabled = false,
    style,
    minimumTrackTintColor = "#ffffff",
    maximumTrackTintColor = "#ffffff40",
}: CustomSliderProps) {
    const isDragging$ = useObservable(false);
    const tempValue$ = useObservable(value);
    const isHovered$ = useObservable(false);
    const isDragging = use$(isDragging$);
    const tempValue = use$(tempValue$);
    const isHovered = use$(isHovered$);

    // Animated value for thumb height
    const thumbHeight = useSharedValue(1);

    // Update temp value when external value changes (but not when dragging)
    useEffect(() => {
        if (!isDragging) {
            tempValue$.set(value);
        }
    }, [value, isDragging]);

    // Animate thumb height based on hover state
    useEffect(() => {
        thumbHeight.value = withTiming(isHovered ? 12 : 1, { duration: 150 });
    }, [isHovered]);

    const handlePress = (event: any) => {
        if (disabled) return;

        const { locationX } = event.nativeEvent;
        const sliderWidth = 300; // Approximate width, could be measured dynamically
        const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
        const newValue = minimumValue + percentage * (maximumValue - minimumValue);

        tempValue$.set(newValue);
        onSlidingComplete?.(newValue);
    };

    const handlePressIn = () => {
        if (disabled) return;
        isDragging$.set(true);
    };

    const handlePressOut = () => {
        if (disabled) return;
        isDragging$.set(false);
        onSlidingComplete?.(tempValue);
    };

    const handleHoverIn = () => {
        if (disabled) return;
        isHovered$.set(true);
    };

    const handleHoverOut = () => {
        if (disabled) return;
        isHovered$.set(false);
    };

    // Calculate progress percentage
    const progress = maximumValue > minimumValue ? (tempValue - minimumValue) / (maximumValue - minimumValue) : 0;

    // Animated style for the thumb
    const thumbAnimatedStyle = useAnimatedStyle(() => {
        const height = thumbHeight.value;
        return {
            height: height,
            top: -height / 2, // Center the line by moving it up by half its height
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
                    <View
                        className="h-full rounded-full"
                        style={{
                            backgroundColor: minimumTrackTintColor,
                            width: `${progress * 100}%`,
                        }}
                    />
                    {/* Vertical line thumb */}
                    <Animated.View
                        className="absolute w-0.5 bg-white"
                        style={[
                            thumbAnimatedStyle,
                            {
                                left: `${progress * 100}%`,
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
