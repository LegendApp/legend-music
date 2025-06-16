import { use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { state$ } from "@/systems/State";

export const BottomStatusBar = () => {
    const navTime = use$(state$.lastNavTime);

    return (
        <View className="h-6 -mb-2 flex-row items-center justify-end">
            <Text className="text-xs text-text-tertiary pr-3">Nav time: {navTime}</Text>
        </View>
    );
};
