import { observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";

import { cn } from "@/utils/cn";

type ToastType = "info" | "error";

type ToastState = {
    message: string;
    type: ToastType;
    visible: boolean;
    id: number;
};

const toast$ = observable<ToastState>({
    message: "",
    type: "info",
    visible: false,
    id: 0,
});

export function showToast(message: string, type: ToastType = "info") {
    if (!message) {
        return;
    }
    const nextId = Date.now();
    toast$.set({
        message,
        type,
        visible: true,
        id: nextId,
    });
}

export function ToastProvider() {
    const toast = use$(toast$);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(8)).current;
    const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (toast.visible) {
            if (hideTimeout.current) {
                clearTimeout(hideTimeout.current);
            }

            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 160,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 160,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();

            hideTimeout.current = setTimeout(() => {
                toast$.visible.set(false);
            }, 3000);

            return () => {
                if (hideTimeout.current) {
                    clearTimeout(hideTimeout.current);
                    hideTimeout.current = null;
                }
            };
        }

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 140,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
                Animated.timing(translateY, {
                    toValue: 8,
                    duration: 140,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
    }, [toast.visible, toast.id, opacity, translateY]);

    if (!toast.visible) {
        return null;
    }

    const containerClass = cn(
        "px-3 py-2 rounded-lg border shadow-lg max-w-xl",
        toast.type === "error"
            ? "bg-red-500/80 border-red-400/70"
            : "bg-emerald-500/70 border-emerald-400/60",
    );

    return (
        <View pointerEvents="none" className="absolute bottom-4 left-0 right-0 items-center z-50">
            <Animated.View
                style={{
                    opacity,
                    transform: [{ translateY }],
                }}
                className={containerClass}
            >
                <Text
                    className={cn(
                        "text-xs font-medium",
                        toast.type === "error" ? "text-red-50" : "text-emerald-50",
                    )}
                    numberOfLines={2}
                >
                    {toast.message}
                </Text>
            </Animated.View>
        </View>
    );
}
