import { type PropsWithChildren, useRef } from "react";
import { type GestureResponderEvent, Pressable, type PressableProps } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";
import { Icon } from "@/systems/Icon";
import { startNavMeasurement } from "@/systems/NavTime";
import type { SFSymbols } from "@/types/SFSymbols";
import { cn } from "@/utils/cn";

const DOUBLE_CLICK_DURATION = 300;
const DOUBLE_CLICK_DISTANCE = 4;

export interface ButtonProps extends PressableProps {
    className?: string;
    icon?: SFSymbols;
    variant?: "icon" | "icon-bg" | "primary" | "secondary" | "accent" | "destructive" | "inverse";
    size?: "small" | "medium" | "large";
    iconSize?: number;
    onMouseDown?: (event: GestureResponderEvent) => void;
    onMouseUp?: (event: GestureResponderEvent) => void;
    onDoubleClick?: (event: GestureResponderEvent) => void;
}

export function Button({
    children,
    className,
    onPress,
    icon,
    variant,
    size,
    iconSize: iconSizeProp,
    onMouseDown,
    onMouseUp,
    onDoubleClick,
    onPressIn,
    onPressOut,
    ...props
}: PropsWithChildren<ButtonProps>) {
    const lastPressRef = useRef<{ time: number; x: number; y: number } | null>(null);
    const handlePress = (event: GestureResponderEvent) => {
        const nativeEvent = event.nativeEvent as unknown as NativeMouseEvent;
        if (nativeEvent?.button !== undefined && nativeEvent.button !== 0) {
            // Only handle left mouse button clicks (button 0)
            // For React Native on macOS, check if the native event has button info
            return;
        }

        const now = Date.now();
        const currentX = nativeEvent?.pageX ?? 0;
        const currentY = nativeEvent?.pageY ?? 0;
        const previous = lastPressRef.current;
        const isDoubleClick =
            previous !== null &&
            now - previous.time <= DOUBLE_CLICK_DURATION &&
            Math.hypot(previous.x - currentX, previous.y - currentY) <= DOUBLE_CLICK_DISTANCE;

        lastPressRef.current = { time: now, x: currentX, y: currentY };

        if (isDoubleClick && onDoubleClick) {
            onDoubleClick(event);
            return;
        }

        // Start measuring navigation time
        startNavMeasurement();

        // Call the original onPress handler if it exists
        onPress?.(event);
    };

    const handlePressIn = (event: GestureResponderEvent) => {
        onMouseDown?.(event);
        onPressIn?.(event);
    };

    const handlePressOut = (event: GestureResponderEvent) => {
        onMouseUp?.(event);
        onPressOut?.(event);
    };

    const iconSize = iconSizeProp ?? (size === "small" ? 14 : size === "large" ? 24 : 18);
    const isIcon = variant === "icon" || variant === "icon-bg";

    return (
        <Pressable
            {...props}
            className={cn(
                icon && children && "flex-row items-center gap-1",
                icon && !children && "items-center justify-center",
                size === "small" && isIcon && "size-7 pb-1.5",
                size === "medium" && isIcon && "size-9 pb-1.5",
                size === "large" && isIcon && "p-4",
                variant === "icon" && "rounded-md hover:bg-white/10",
                variant === "icon-bg" &&
                    "rounded-md bg-background-secondary border border-border-primary hover:bg-white/10",
                size === "small" && !isIcon && "h-7 px-2 justify-center items-center",
                size === "medium" && !isIcon && "h-9 px-3 justify-center items-center",
                size === "large" && !isIcon && "h-11 px-4 justify-center items-center",
                variant === "primary" && "rounded-md bg-background-primary",
                variant === "accent" && "rounded-md bg-accent-primary",
                variant === "secondary" && "rounded-md bg-background-secondary",
                variant === "destructive" && "rounded-md bg-background-destructive",
                className,
            )}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            {icon && <Icon name={icon} size={iconSize} />}
            {children}
        </Pressable>
    );
}
