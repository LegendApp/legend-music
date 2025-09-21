import { useEffect, useRef } from "react";

import { useWindowManager } from "@/native-modules/WindowManager";

import { useWindowId } from "./WindowProvider";

export function useWindowFocusEffect(callback: () => void) {
    const windowId = useWindowId();
    const windowManagerRef = useRef(useWindowManager());

    useEffect(() => {
        if (!windowId) {
            return;
        }

        const subscription = windowManagerRef.current.onWindowFocused(({ identifier }) => {
            if (identifier === windowId) {
                callback();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [callback, windowId]);
}
