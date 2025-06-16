import type { ReactNode } from "react";
import { View } from "react-native";

import { Icon } from "@/systems/Icon";
import { cn } from "@/utils/cn";

interface WithCheckProps {
    checked: boolean;
    children: ReactNode;
    className?: string;
}

/**
 * Utility component that wraps content with an optional checkbox
 */
export function WithCheck({ checked, children, className }: WithCheckProps) {
    return (
        <View className={cn("flex-row gap-x-4 justify-between -mr-1", className)}>
            <View>{children}</View>
            {checked ? <Icon name="checkmark" size={13} /> : null}
        </View>
    );
}
