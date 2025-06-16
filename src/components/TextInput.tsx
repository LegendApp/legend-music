import type { Observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";
import { memo, useCallback } from "react";
import { TextInput as TextInputNative } from "react-native";

import { state$ } from "@/systems/State";

export interface TextInputProps extends React.ComponentProps<typeof TextInputNative> {
    value$?: Observable<string>;
}

export const TextInput = memo(function TextInput({
    value: valueProp,
    value$,
    onChangeText: onChangeTextProp,
    ...rest
}: TextInputProps) {
    const isDropdownOpen = use$(state$.isDropdownOpen);
    const value = value$ ? value$.peek() : valueProp;

    const onChangeText = useCallback((text: string) => {
        if (value$) {
            value$.set(text);
        }
        onChangeTextProp?.(text);
    }, []);

    return <TextInputNative {...rest} defaultValue={value} onChangeText={onChangeText} editable={!isDropdownOpen} />;
});
