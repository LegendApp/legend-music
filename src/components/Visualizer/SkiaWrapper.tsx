import React, { type ReactNode } from "react";
import { Text, View } from "react-native";

type SkiaWrapperProps = {
    children: ReactNode;
    fallback?: ReactNode;
};

type SkiaWrapperState = {
    hasError: boolean;
    error?: Error;
};

/**
 * Error boundary wrapper for Skia components to handle initialization issues
 * in separate window contexts
 */
export class SkiaWrapper extends React.Component<SkiaWrapperProps, SkiaWrapperState> {
    constructor(props: SkiaWrapperProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): SkiaWrapperState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Skia rendering error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View className="flex-1 items-center justify-center p-6">
                    <Text className="text-white/70 text-center">Visualizer unavailable: Skia initialization error</Text>
                    <Text className="text-white/40 text-xs mt-2 text-center">{this.state.error?.message}</Text>
                </View>
            );
        }

        return this.props.children;
    }
}
