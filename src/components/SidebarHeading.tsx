import { Text } from "react-native";

import { cn } from "@/utils/cn";

interface SidebarHeadingProps {
    text: string;
    className?: string;
}

export function SidebarHeading({ text, className }: SidebarHeadingProps) {
    return <Text className={cn("text-text-tertiary text-xs pt-4 pb-1 pl-3", className)}>{text}</Text>;
}
