import type { Observable } from "@legendapp/state";
import { forwardRef } from "react";
import { StyleSheet, type TextInputProps } from "react-native";

import { TextInput } from "@/components/TextInput";
import { cn } from "@/utils/cn";

export interface StyledInputProps extends TextInputProps {
    value$: Observable<string>;
    ignoreDropdownState?: boolean;
}

export const StyledInput = forwardRef<any, StyledInputProps>(function StyledInput({ value$, className, ...rest }, ref) {
    return (
        <TextInput
            ref={ref}
            value$={value$}
            className={cn(
                "bg-background-secondary px-3 h-9 py-2 rounded-md text-sm text-text-primary border border-border-primary",
                className,
            )}
            style={styles.textInput}
            {...rest}
        />
    );
});

const styles = StyleSheet.create({
    textInput: {
        paddingVertical: 7,
    },
});
