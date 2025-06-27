import { use$, useObservable } from "@legendapp/state/react";
import { useEffect } from "react";
import { Pressable, View } from "react-native";

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
	const isDragging = use$(isDragging$);
	const tempValue = use$(tempValue$);

	// Update temp value when external value changes (but not when dragging)
	useEffect(() => {
		if (!isDragging) {
			tempValue$.set(value);
		}
	}, [value, isDragging]);

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

	// Calculate progress percentage
	const progress =
		maximumValue > minimumValue
			? (tempValue - minimumValue) / (maximumValue - minimumValue)
			: 0;

	return (
		<View style={[{ height: 40 }, style]}>
			<Pressable
				onPress={handlePress}
				onPressIn={handlePressIn}
				onPressOut={handlePressOut}
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
					{/* Thumb */}
					<View
						className="absolute w-4 h-4 bg-white rounded-full -top-1.5"
						style={{
							left: `${progress * 100}%`,
							marginLeft: -8, // Half of thumb width
							opacity: disabled ? 0.5 : 1,
						}}
					/>
				</View>
			</Pressable>
		</View>
	);
}
