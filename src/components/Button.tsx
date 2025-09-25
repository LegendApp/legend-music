import { type PropsWithChildren, useRef } from "react";
import { type GestureResponderEvent, Pressable, type PressableProps } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";

import { Icon } from "@/systems/Icon";
import { startNavMeasurement } from "@/systems/NavTime";
import type { SFSymbols } from "@/types/SFSymbols";
import { cn } from "@/utils/cn";

const DOUBLE_CLICK_DURATION = 300;
const DOUBLE_CLICK_DISTANCE = 4;

export interface ButtonProps
    extends Omit<PressableProps, "onPress" | "onPressIn" | "onPressOut" | "onClick" | "onMouseDown" | "onMouseUp"> {
    className?: string;
    icon?: SFSymbols;
    variant?: "icon" | "icon-bg" | "primary" | "secondary" | "accent" | "destructive" | "inverse";
    size?: "small" | "medium" | "large";
    iconSize?: number;
    onClick?: (event: GestureResponderEvent) => void;
    onMouseDown?: (event: GestureResponderEvent) => void;
    onMouseUp?: (event: GestureResponderEvent) => void;
    onDoubleClick?: (event: GestureResponderEvent) => void;
    onRightClick?: (event: GestureResponderEvent) => void;
}

export function Button({
    children,
    className,
    icon,
    variant,
    size,
    iconSize: iconSizeProp,
    onClick,
    onMouseDown,
    onMouseUp,
    onDoubleClick,
    onRightClick,
    ...props
}: PropsWithChildren<ButtonProps>) {
    const lastClickRef = useRef<{ time: number; x: number; y: number } | null>(null);

    const handleClick = (event: GestureResponderEvent) => {
        const nativeEvent = event.nativeEvent as unknown as NativeMouseEvent;

        if (nativeEvent?.button !== undefined && nativeEvent.button !== 0) {
            // Only handle left mouse button clicks
            return;
        }

        const now = Date.now();
        const currentX = nativeEvent?.pageX ?? nativeEvent?.clientX ?? nativeEvent?.x ?? 0;
        const currentY = nativeEvent?.pageY ?? nativeEvent?.clientY ?? nativeEvent?.y ?? 0;
        const previous = lastClickRef.current;
        const isDoubleClick =
            previous !== null &&
            now - previous.time <= DOUBLE_CLICK_DURATION &&
            Math.hypot(previous.x - currentX, previous.y - currentY) <= DOUBLE_CLICK_DISTANCE;

        lastClickRef.current = { time: now, x: currentX, y: currentY };

        if (isDoubleClick && onDoubleClick) {
            onDoubleClick(event);
            return;
        }

        startNavMeasurement();
        onClick?.(event);
    };

    const handleMouseDown = (event: GestureResponderEvent) => {
        const nativeEvent = event.nativeEvent as unknown as NativeMouseEvent;

        if (nativeEvent?.button === 2 || nativeEvent.ctrlKey) {
            onRightClick?.(event);
        } else {
            onMouseDown?.(event);
        }
    };

    const handleMouseUp = (event: GestureResponderEvent) => {
        const nativeEvent = event.nativeEvent as unknown as NativeMouseEvent;

        onMouseUp?.(event);
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
            onPress={handleClick}
            onPressIn={handleMouseDown}
            onPressOut={handleMouseUp}
        >
            {icon && <Icon name={icon} size={iconSize} />}
            {children}
        </Pressable>
    );
}
