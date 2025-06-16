import type { Observable } from "@legendapp/state";
import { StyleSheet, type TextInputProps } from "react-native";

import { TextInput } from "@/components/TextInput";
import { cn } from "@/utils/cn";

export interface StyledInputProps extends TextInputProps {
    value$: Observable<string>;
}

export function StyledInput({ value$, className, ...rest }: StyledInputProps) {
    return (
        <TextInput
            value$={value$}
            className={cn(
                "bg-background-secondary px-3 h-9 rounded-md text-sm text-text-primary border border-border-primary",
                className,
            )}
            style={styles.textInput}
            {...rest}
        />
    );
}

const styles = StyleSheet.create({
    textInput: {
        paddingVertical: 7,
    },
});
