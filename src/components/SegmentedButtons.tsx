import { Pressable, Text, View } from "react-native";
import { cn } from "@/utils/cn";

type SegmentedOption<T extends string> = {
    value: T;
    label: string;
    disabled?: boolean;
};

export type SegmentedButtonsProps<T extends string> = {
    value: T;
    options: ReadonlyArray<SegmentedOption<T>>;
    onValueChange: (value: T) => void;
    className?: string;
    buttonClassName?: string;
};

export function SegmentedButtons<T extends string>({
    value,
    options,
    onValueChange,
    className,
    buttonClassName,
}: SegmentedButtonsProps<T>) {
    return (
        <View
            className={cn("flex-row rounded-md border border-border-primary bg-background-secondary p-0.5", className)}
        >
            {options.map((option) => {
                const isSelected = option.value === value;
                const isDisabled = Boolean(option.disabled);

                return (
                    <Pressable
                        key={option.value}
                        disabled={isDisabled}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isDisabled, selected: isSelected }}
                        onPress={() => {
                            if (!isDisabled) {
                                onValueChange(option.value);
                            }
                        }}
                        className={cn(
                            "flex-1 items-center justify-center rounded-[6px] px-2 py-1",
                            isSelected ? "bg-white/15" : "hover:bg-white/10",
                            isDisabled && "opacity-40",
                            buttonClassName,
                        )}
                    >
                        <Text
                            numberOfLines={1}
                            className={cn(
                                "text-[11px] font-medium",
                                isSelected ? "text-text-primary" : "text-text-secondary",
                            )}
                        >
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
