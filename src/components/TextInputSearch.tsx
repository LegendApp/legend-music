import { type Observable, observable } from "@legendapp/state";
import { useValue } from "@legendapp/state/react";
import { forwardRef, memo, useCallback, useImperativeHandle, useRef } from "react";
import {
    findNodeHandle,
    NativeModules,
    type NativeSyntheticEvent,
    requireNativeComponent,
    type ViewProps,
} from "react-native";

interface TextInputSearchNativeProps extends ViewProps {
    placeholder?: string;
    text?: string;
    defaultText?: string;
    onChangeText?: (event: NativeSyntheticEvent<{ text: string }>) => void;
}

const TextInputSearchNative = requireNativeComponent<TextInputSearchNativeProps>("TextInputSearch");

export interface TextInputSearchProps
    extends Omit<TextInputSearchNativeProps, "text" | "defaultText" | "onChangeText"> {
    value$?: Observable<string>;
    value?: string;
    defaultValue?: string;
    onChangeText?: (text: string) => void;
}

export interface TextInputSearchRef {
    focus(): void;
}

export const TextInputSearch = memo(
    forwardRef<TextInputSearchRef, TextInputSearchProps>(function TextInputSearch(
        { value$, value, defaultValue, onChangeText, ...rest },
        ref,
    ) {
        const defaultText = defaultValue ?? value$?.peek();
        const nativeRef = useRef<any>(null);

        useImperativeHandle(
            ref,
            () => ({
                focus: () => {
                    const reactTag = findNodeHandle(nativeRef.current);
                    if (reactTag) {
                        NativeModules.TextInputSearch.focus(reactTag);
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

        return (
            <TextInputSearchNative
                ref={nativeRef}
                defaultText={defaultText}
                onChangeText={handleChangeText}
                style={{ minHeight: 32 }}
                {...rest}
            />
        );
    }),
);
