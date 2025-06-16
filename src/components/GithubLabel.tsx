import { Text, View } from "react-native";

import { cn } from "@/utils/cn";
import { calculateGithubLabelColors } from "../utils/colorUtils";

interface GithubLabelProps {
    name: string;
    color: string;
    className?: string;
}

export function GithubLabel({ name, color, className }: GithubLabelProps) {
    // Get all the calculated colors from our utility function
    const { textColor, backgroundColor, borderColor } = calculateGithubLabelColors(color);

    return (
        <View
            style={{ backgroundColor, borderColor }}
            className={cn("rounded-full px-2 py-0.5 border bg-blue-400", className)}
        >
            <Text style={{ color: textColor }} className="text-xs font-medium">
                {name}
            </Text>
        </View>
    );
}
