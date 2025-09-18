import { useHookKeyboard } from "@/systems/keyboard/Keyboard";
import React from "react";
import { TextInput } from "react-native";
import { perfCount, perfLog } from "@/utils/perfLogger";

export function HookKeyboard() {
    perfCount("HookKeyboard.render");
    useHookKeyboard();

    return <HiddenTextInput />;
}

export function HiddenTextInput() {
    perfCount("HookKeyboard.HiddenTextInput.render");
    return (
        <TextInput
            className="absolute left-[-1000px] h-0 w-0 opacity-0"
            onBlur={(e) => {
                perfLog("HookKeyboard.HiddenTextInput.onBlur");
                e.preventDefault();
                // Refocus the input to ensure keyboard events are captured
                e.target.focus();
            }}
            onFocus={() => perfLog("HookKeyboard.HiddenTextInput.onFocus")}
            autoFocus
        />
    );
}
