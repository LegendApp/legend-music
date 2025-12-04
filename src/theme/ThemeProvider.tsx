import { useObservable, useValue } from "@legendapp/state/react";
import { vars } from "nativewind";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { View } from "react-native";

import { createJSONManager } from "@/utils/JSONManager";
import { colors } from "./colors";

// Define theme types
type ThemeType = "dark";
type ThemeContextType = {
    currentTheme: ThemeType;
    setTheme: () => void;
    resetTheme: () => void;
};

interface ThemeSettings {
    currentTheme: ThemeType;
    customColors: {
        dark: typeof colors.dark;
    };
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

// Create a global observable for theme state
export const themeState$ = createJSONManager<ThemeSettings>({
    filename: "theme",
    initialValue: {
        currentTheme: "dark" as ThemeType,
        customColors: clone(colors),
    },
    saveDefaultToFile: true,
});

// Create theme variables for each theme
const useThemeStyle = (theme$: typeof themeState$) => {
    const { dark } = useValue(theme$.customColors);
    return {
        dark: vars({
            "--background-primary": dark.background.primary,
            "--background-secondary": dark.background.secondary,
            "--background-tertiary": dark.background.tertiary,
            "--background-destructive": dark.background.destructive,
            "--background-inverse": dark.background.inverse,
            "--text-primary": dark.text.primary,
            "--text-secondary": dark.text.secondary,
            "--text-tertiary": dark.text.tertiary,
            "--accent-primary": dark.accent.primary,
            "--accent-secondary": dark.accent.secondary,
            "--border-primary": dark.border.primary,
            "--border-popup": dark.border.popup,
        }),
    };
};

// Create context for theme
const ThemeContext = createContext<ThemeContextType>(undefined as any);

// Theme provider component
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const currentTheme = useValue(themeState$.currentTheme);
    const style = useThemeStyle(themeState$).dark;

    if (currentTheme !== "dark") {
        themeState$.currentTheme.set("dark");
    }

    const setTheme = () => {
        // themeState$.currentTheme.set("dark");
    };

    const resetTheme = () => {
        // themeState$.customColors.set(clone(colors));
    };

    // Context value
    const contextValue: ThemeContextType = useMemo(
        () => ({
            currentTheme: "dark",
            setTheme,
            resetTheme,
        }),
        [],
    );

    return (
        <ThemeContext.Provider value={contextValue}>
            <View className="flex-1" style={style}>
                {children}
            </View>
        </ThemeContext.Provider>
    );
};

// Hook to use theme
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};
