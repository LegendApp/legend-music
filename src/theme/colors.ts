// Color palette definitions for the app
export const colors = {
    // Define base colors
    dark: {
        background: {
            primary: "#111",
            secondary: "#17181A",
            tertiary: "#212224",
            destructive: "#8b0000",
            inverse: "#fff",
        },
        text: {
            primary: "#fff",
            secondary: "#aaa",
            tertiary: "#777",
        },
        accent: {
            primary: "#0088ff",
            secondary: "#00aaff",
        },
        border: {
            primary: "#252730",
            popup: "#33353a",
        },
    },

    light: {
        background: {
            primary: "#fff",
            secondary: "#f5f5f5",
            tertiary: "#eaeaea",
            destructive: "#8b0000",
            inverse: "#111",
        },
        text: {
            primary: "#111",
            secondary: "#555",
            tertiary: "#999",
        },
        accent: {
            primary: "#0066cc",
            secondary: "#0088dd",
        },
        border: {
            primary: "#ddd",
            popup: "#ccc",
        },
    },
};

// Export color variables for tailwind config
export const themeColors = {
    "background-primary": "var(--background-primary)",
    "background-secondary": "var(--background-secondary)",
    "background-tertiary": "var(--background-tertiary)",
    "background-destructive": "var(--background-destructive)",
    "background-inverse": "var(--background-inverse)",
    "text-primary": "var(--text-primary)",
    "text-secondary": "var(--text-secondary)",
    "text-tertiary": "var(--text-tertiary)",
    "accent-primary": "var(--accent-primary)",
    "accent-secondary": "var(--accent-secondary)",
    "border-primary": "var(--border-primary)",
    "border-popup": "var(--border-popup)",
};
