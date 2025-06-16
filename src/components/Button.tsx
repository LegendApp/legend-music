import type { PropsWithChildren } from "react";
import { Pressable, type PressableProps } from "react-native";

import { Icon } from "@/systems/Icon";
import { startNavMeasurement } from "@/systems/NavTime";
import type { SFSymbols } from "@/types/SFSymbols";
import { cn } from "@/utils/cn";

export interface ButtonProps extends PressableProps {
    className?: string;
    icon?: SFSymbols;
    variant?: "icon" | "icon-bg" | "primary" | "secondary" | "accent" | "destructive" | "inverse";
    size?: "small" | "medium" | "large";
    iconSize?: number;
}

export function Button({
    children,
    className,
    onPress,
    icon,
    variant,
    size,
    iconSize: iconSizeProp,
    ...props
}: PropsWithChildren<ButtonProps>) {
    const handlePress = (e: any) => {
        // Start measuring navigation time
        startNavMeasurement();

        // Call the original onPress handler if it exists
        onPress?.(e);
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
                variant === "icon" && "rounded-md",
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
        >
            {icon && <Icon name={icon} size={iconSize} />}
            {children}
        </Pressable>
    );
}
