import { InteractionManager } from "react-native";

export const runAfterInteractions = (callback: () => void) => {
    return InteractionManager.runAfterInteractions(callback);
};
