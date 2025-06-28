import type { GestureResponderEvent } from "react-native";

export interface GestureResponderEventWithButton extends GestureResponderEvent {
    nativeEvent: GestureResponderEvent["nativeEvent"] & {
        button?: number;
    };
}
