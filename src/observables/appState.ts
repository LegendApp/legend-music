import { observable } from "@legendapp/state";
import { AppState } from "react-native";

export const appState$ = observable({
    isActive: false,
    state: AppState.currentState,
});

AppState.addEventListener("change", (nextAppState) => {
    console.log("app state", nextAppState);
    appState$.set({
        isActive: nextAppState === "active",
        state: nextAppState,
    });
});
