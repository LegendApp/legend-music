import { NativeModules } from "react-native";

interface SaveDialogOptions {
    defaultName?: string;
    directory?: string;
    allowedFileTypes?: string[];
}

interface FileDialogModule {
    showSaveDialog(options: SaveDialogOptions): Promise<string | null>;
}

const module = NativeModules.FileDialogManager as FileDialogModule | undefined;

export async function showSaveDialog(options: SaveDialogOptions = {}): Promise<string | null> {
    if (!module?.showSaveDialog) {
        return null;
    }

    try {
        const result = await module.showSaveDialog(options);
        return typeof result === "string" && result.length > 0 ? result : null;
    } catch (error) {
        console.error("FileDialogManager.showSaveDialog failed", error);
        return null;
    }
}
