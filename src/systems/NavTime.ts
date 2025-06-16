import { InteractionManager } from "react-native";

import { state$ } from "@/systems/State";

export const startNavMeasurement = () => {
    state$.lastNavStart.set(Date.now());
};

export const measureNavTime = () => {
    InteractionManager.runAfterInteractions(() => {
        const now = Date.now();
        const start = state$.lastNavStart.get();
        if (start > 0) {
            state$.lastNavTime.set(now - start);
        }
    });
};
