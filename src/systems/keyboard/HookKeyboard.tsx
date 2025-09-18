import { useHookKeyboard } from "@/systems/keyboard/Keyboard";
import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus, TextInput } from "react-native";
import { perfCount, perfLog } from "@/utils/perfLogger";

export function HookKeyboard() {
    perfCount("HookKeyboard.render");
    useHookKeyboard();

    return <HiddenTextInput />;
}

export function HiddenTextInput() {
    perfCount("HookKeyboard.HiddenTextInput.render");
    const inputRef = useRef<TextInput>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        const tryFocus = () => {
            if (appStateRef.current === "active") {
                inputRef.current?.focus();
            }
        };

        // Focus shortly after mount so the keyboard hook starts immediately.
        const focusTimeout = setTimeout(tryFocus, 10);

        const subscription = AppState.addEventListener("change", (state) => {
            appStateRef.current = state;
            perfLog("HookKeyboard.AppStateChange", { state });

            if (state === "active") {
                // Delay a little so the window becomes active before refocusing.
                setTimeout(tryFocus, 50);
            }
        });

        return () => {
            clearTimeout(focusTimeout);
            subscription.remove();
        };
    }, []);

    return (
        <TextInput
            ref={inputRef}
            className="absolute left-[-1000px] h-0 w-0 opacity-0"
            onBlur={(e) => {
                perfLog("HookKeyboard.HiddenTextInput.onBlur");
                if (appStateRef.current === "active") {
                    e.preventDefault();
                    requestAnimationFrame(() => {
                        if (appStateRef.current === "active") {
                            inputRef.current?.focus();
                        }
                    });
                }
            }}
            onFocus={() => perfLog("HookKeyboard.HiddenTextInput.onFocus")}
            autoFocus
        />
    );
}
