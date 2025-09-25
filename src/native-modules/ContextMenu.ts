import { NativeModules, Platform } from "react-native";

export interface ContextMenuItem {
    id: string;
    title: string;
    enabled?: boolean;
}

interface ContextMenuLocation {
    x: number;
    y: number;
}

type NativeContextMenuModule = {
    showMenu?: (items: ContextMenuItem[], location: ContextMenuLocation) => Promise<string | null>;
};

const { ContextMenuManager = {} as NativeContextMenuModule } = NativeModules;

export async function showContextMenu(
    items: ContextMenuItem[],
    location: ContextMenuLocation,
): Promise<string | null> {
    if (Platform.OS !== "macos") {
        return null;
    }

    const { showMenu } = ContextMenuManager;
    if (typeof showMenu !== "function") {
        if (__DEV__) {
            console.warn("ContextMenuManager.showMenu is not available");
        }
        return null;
    }

    try {
        const result = await showMenu(items, location);
        if (typeof result === "string" && result.length > 0) {
            return result;
        }
        return null;
    } catch (error) {
        console.error("Failed to display context menu:", error);
        return null;
    }
}
