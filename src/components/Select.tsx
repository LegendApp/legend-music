import { useCallback, useState } from "react";
import { Text, type LayoutChangeEvent } from "react-native";
import type { ObservableParam } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";

import { DropdownMenu } from "@/components/DropdownMenu";
import { cn } from "@/utils/cn";

export interface SelectOption {
    label: string;
    value: string;
    disabled?: boolean;
}

export interface SelectProps {
    options: SelectOption[];
    value$?: ObservableParam<string>;
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
    textClassName?: string;
    disabled?: boolean;
    minWidth?: number | "auto";
    maxWidth?: number;
}

export function Select({
    options,
    value$,
    value: valueProp,
    onValueChange,
    placeholder = "Select...",
    className,
    triggerClassName,
    textClassName,
    disabled = false,
    minWidth,
    maxWidth,
}: SelectProps) {
    const value = value$ ? useValue(value$) : valueProp;
    const [triggerWidth, setTriggerWidth] = useState<number | null>(null);

    const handleTriggerLayout = useCallback((event: LayoutChangeEvent) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (Number.isFinite(nextWidth) && nextWidth > 0 && nextWidth !== triggerWidth) {
            setTriggerWidth(nextWidth);
        }
    }, [triggerWidth]);

    const isAutoWidth = minWidth === "auto";
    const resolvedMinWidth = isAutoWidth ? triggerWidth ?? 0 : minWidth;
    const resolvedMaxWidth = isAutoWidth ? (triggerWidth ?? undefined) : maxWidth;

    const selectedOption = options.find((option) => option.value === value);
    const displayText = selectedOption ? selectedOption.label : placeholder;

    const handleSelect = (selectedValue: string) => {
        value$?.set(selectedValue);
        onValueChange?.(selectedValue);
    };

    return (
        <DropdownMenu.Root closeOnSelect={true}>
            <DropdownMenu.Trigger
                className={cn(
                    "bg-background-secondary hover:bg-background-tertiary rounded-md flex-row justify-between items-center overflow-hidden border border-border-primary h-8 px-2",
                    disabled && "opacity-50 pointer-events-none",
                    triggerClassName,
                )}
                disabled={disabled}
                showCaret={true}
                caretPosition="right"
                onLayout={isAutoWidth ? handleTriggerLayout : undefined}
            >
                <Text className={cn("text-text-primary text-sm", textClassName)} numberOfLines={1}>
                    {displayText}
                </Text>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className={className} minWidth={resolvedMinWidth} maxWidth={resolvedMaxWidth}>
                {options.map((option) => (
                    <DropdownMenu.Item
                        key={option.value}
                        onSelect={() => handleSelect(option.value)}
                        disabled={option.disabled}
                        className={cn(
                            "px-3 py-2 hover:bg-background-tertiary",
                            value === option.value && "bg-background-tertiary",
                        )}
                    >
                        <Text className={cn("text-text-primary text-sm", option.disabled && "text-text-secondary")}>
                            {option.label}
                        </Text>
                    </DropdownMenu.Item>
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}
