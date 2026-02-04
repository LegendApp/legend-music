import type { Observable } from "@legendapp/state";
import { cssInterop } from "nativewind";
import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import {
    findNodeHandle,
    NativeModules,
    type NativeSyntheticEvent,
    processColor,
    requireNativeComponent,
    type StyleProp,
    type ViewProps,
    type ViewStyle,
} from "react-native";

interface TextInputMacNativeProps extends ViewProps {
    placeholder?: string;
    placeholderTextColor?: string;
    text?: string;
    defaultText?: string;
    textColor?: string;
    fontSize?: number;
    secureTextEntry?: boolean;
    editable?: boolean;
    selectable?: boolean;
    multiline?: boolean;
    onChangeText?: (event: NativeSyntheticEvent<{ text: string }>) => void;
    onSubmit?: (event: NativeSyntheticEvent<{ text: string }>) => void;
    onFocus?: (event: NativeSyntheticEvent<object>) => void;
    onBlur?: (event: NativeSyntheticEvent<object>) => void;
}

const TextInputMacNative = requireNativeComponent<TextInputMacNativeProps>("TextInputMac");

cssInterop(TextInputMacNative, {
    className: {
        target: "style",
        nativeStyleToProp: {
            color: "textColor",
        },
    },
});

export interface TextInputMacProps
    extends Omit<
        TextInputMacNativeProps,
        "text" | "defaultText" | "onChangeText" | "onSubmit" | "onFocus" | "onBlur"
    > {
    value$?: Observable<string>;
    value?: string;
    defaultValue?: string;
    onChangeText?: (text: string) => void;
    onSubmitEditing?: (text: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

export interface TextInputMacRef {
    focus(): void;
    blur(): void;
}

export const TextInputMac = memo(
    forwardRef<TextInputMacRef, TextInputMacProps>(function TextInputMac(
        { value$, value, defaultValue, onChangeText, onSubmitEditing, onFocus, onBlur, style, multiline, ...rest },
        ref,
    ) {
        const defaultText = defaultValue ?? value$?.peek();
        const nativeRef = useRef<any>(null);

        const mergedStyle = useMemo((): StyleProp<ViewStyle> => {
            const defaultHeight = multiline ? 64 : 22;
            return [{ minHeight: defaultHeight }, style];
        }, [multiline, style]);

        useImperativeHandle(
            ref,
            () => ({
                focus: () => {
                    const reactTag = findNodeHandle(nativeRef.current);
                    if (reactTag) {
                        NativeModules.TextInputMac.focus(reactTag);
                    }
                },
                blur: () => {
                    const reactTag = findNodeHandle(nativeRef.current);
                    if (reactTag) {
                        NativeModules.TextInputMac.blur(reactTag);
                    }
                },
            }),
            [],
        );

        const handleChangeText = useCallback(
            (event: NativeSyntheticEvent<{ text: string }>) => {
                const text = event.nativeEvent.text;
                if (value$) {
                    value$.set(text);
                }
                onChangeText?.(text);
            },
            [value$, onChangeText],
        );

        const handleSubmit = useCallback(
            (event: NativeSyntheticEvent<{ text: string }>) => {
                onSubmitEditing?.(event.nativeEvent.text);
            },
            [onSubmitEditing],
        );

        const handleFocus = useCallback(() => {
            onFocus?.();
        }, [onFocus]);

        const handleBlur = useCallback(() => {
            onBlur?.();
        }, [onBlur]);

        return (
            <TextInputMacNative
                ref={nativeRef}
                defaultText={defaultText}
                onChangeText={handleChangeText}
                onSubmit={onSubmitEditing ? handleSubmit : undefined}
                onFocus={onFocus ? handleFocus : undefined}
                onBlur={onBlur ? handleBlur : undefined}
                multiline={multiline}
                style={mergedStyle}
                {...rest}
            />
        );
    }),
);
