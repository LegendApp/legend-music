import type { Observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { forwardRef, useCallback } from "react";
import { TextInput as TextInputNative } from "react-native";

import { state$ } from "@/systems/State";

export interface TextInputProps extends React.ComponentProps<typeof TextInputNative> {
    value$?: Observable<string>;
    ignoreDropdownState?: boolean;
}

export const TextInput = forwardRef<TextInputNative, TextInputProps>(function TextInput({
    value: valueProp,
    value$,
    onChangeText: onChangeTextProp,
    ignoreDropdownState = false,
    ...rest
}, ref) {
    const isDropdownOpen = use$(state$.isDropdownOpen);
    const value = value$ ? value$.peek() : valueProp;

    const onChangeText = useCallback((text: string) => {
        if (value$) {
            value$.set(text);
        }
        onChangeTextProp?.(text);
    }, [value$, onChangeTextProp]);

    return <TextInputNative {...rest} ref={ref} defaultValue={value} onChangeText={onChangeText} editable={ignoreDropdownState || !isDropdownOpen} />;
});
