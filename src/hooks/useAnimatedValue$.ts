import type { Observable } from "@legendapp/state";
import { useObserveEffect } from "@legendapp/state/react";
import { useAnimatedValue } from "react-native";

export function useAnimatedValue$<T>(value$: Observable<T>) {
    const animated = useAnimatedValue(value$.peek());

    useObserveEffect(() => {
        const unsubscribe = value$.onChange(({ value }) => {
            animated.setValue(value);
        });

        return () => unsubscribe();
    });

    return animated;
}
