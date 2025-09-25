import type { Observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { state$ } from "@/systems/State";
import type { GestureResponderEventWithButton } from "@/types/types";
import { cn } from "@/utils/cn";
import { Button } from "./Button";

export interface SidebarButtonProps {
    text: string;
    value: string;
    selectedItem$: Observable<string>;
    indentLevel?: number;
}

export function SidebarButton({ text, value, selectedItem$, indentLevel = 0 }: SidebarButtonProps) {
    const isSelected = use$(() => selectedItem$.get() === value);
    const textColor = isSelected ? "text-text-primary" : "text-text-secondary";
    const indentPadding = 8 + indentLevel * 12;
    const isDropdownOpen = use$(state$.isDropdownOpen);

    return (
        <Button
            className={cn(
                "py-2 rounded-md mx-1",
                isSelected && "bg-white/20",
                !isSelected && !isDropdownOpen && "hover:bg-white/20",
            )}
            onClick={(e: GestureResponderEventWithButton) => {
                if (e.nativeEvent.button === 2) {
                    console.log("right click");
                    e.preventDefault();
                    e.stopPropagation();
                } else {
                    selectedItem$.set(value);
                }
            }}
        >
            <View className="flex-row items-center" style={{ paddingLeft: indentPadding }}>
                <Text className={cn("text-sm", textColor, isSelected && "font-medium")}>{text}</Text>
            </View>
        </Button>
    );
}
