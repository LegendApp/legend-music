import type { Observable } from "@legendapp/state";
import { use$, useObservable } from "@legendapp/state/react";
import { useMemo, useRef } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { colors } from "@/theme/colors";
import { cn } from "@/utils/cn";

// Interface for props
type MarkdownEditorProps = {
    value$: Observable<string>;
    className?: string;
    onChange?: (content: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
};

export const MarkdownEditor = ({ className, value$, onChange, onFocus, onBlur }: MarkdownEditorProps) => {
    const isLoading$ = useObservable(true);
    const webViewRef = useRef<WebView>(null);
    const isEditorReady$ = useObservable(false);
    const webViewHeight$ = useObservable(300); // Default height until we get a real value
    const webViewHeight = use$(webViewHeight$);

    const colorScheme = useColorScheme();

    const bg = colors[colorScheme!].background.secondary;

    // Handle messages from WebView
    const handleMessage = (event: WebViewMessageEvent) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);

            switch (data.type) {
                case "contentChanged":
                    value$.set(data.content);
                    onChange?.(data.content);
                    break;
                case "editorReady":
                    isEditorReady$.set(true);
                    break;
                case "focus":
                    onFocus?.();
                    break;
                case "blur":
                    onBlur?.();
                    break;
                case "resize":
                    webViewHeight$.set(Math.max(data.height, 100));
                    break;
                case "log":
                    console.log("[WebView]", ...data.data);
                    break;
            }
        } catch (error) {
            console.error("Error handling message from WebView:", error);
        }
    };

    // JavaScript to inject into WebView for initial setup
    const injectedJavaScript = useMemo(
        () => `
        // Override the default console.log to send logs to React Native
        (function() {
            const originalConsoleLog = console.log;
            console.log = function(...args) {
                originalConsoleLog.apply(console, args);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log',
                    data: args.map(arg => String(arg))
                }));
            };

            window.initializeEditor(${JSON.stringify(value$.get())}, "Write a comment...", "${bg}");
        })();

        true;
    `,
        [],
    );

    return (
        <View className={cn("overflow-hidden", className)} style={styles.container}>
            <WebView
                ref={webViewRef}
                source={{ uri: "./MarkdownEditor.html" }}
                originWhitelist={["*"]}
                onLoadEnd={() => isLoading$.set(false)}
                onMessage={handleMessage}
                injectedJavaScript={injectedJavaScript}
                style={[styles.webview, { height: webViewHeight }]}
                scrollEnabled={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webview: {
        flex: 0, // Changed from 1 to 0 to allow explicit height
        width: "100%",
        backgroundColor: "red",
    },
});
