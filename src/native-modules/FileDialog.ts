import * as FileSystem from "expo-file-system/next";
import { NativeModules, Platform } from "react-native";

type DirectoryLike = string | { uri?: string } | null | undefined;

type NativeFileDialogModule = {
    open?: (options: NativeFileDialogOpenOptions) => Promise<string[] | null>;
    save?: (options: NativeFileDialogSaveOptions) => Promise<string | null>;
};

type NativeFileDialogOpenOptions = {
    canChooseFiles?: boolean;
    canChooseDirectories?: boolean;
    allowsMultipleSelection?: boolean;
    directoryURL?: string | null;
};

type NativeFileDialogSaveOptions = {
    suggestedFileName?: string;
    directoryURL?: string | null;
};

const { FileDialog: NativeFileDialog = {} as NativeFileDialogModule } = NativeModules;

export interface FileDialogOpenOptions {
    canChooseFiles?: boolean;
    canChooseDirectories?: boolean;
    allowsMultipleSelection?: boolean;
    directoryURL?: DirectoryLike;
}

export interface FileDialogSaveOptions {
    suggestedFileName?: string;
    directoryURL?: DirectoryLike;
}

export const defaultDirectoryUri = FileSystem.Paths.document?.uri ?? null;
export const defaultDirectoryPath = defaultDirectoryUri ? fileUriToPath(defaultDirectoryUri) : null;

function resolveDirectory(directory?: DirectoryLike): string | null {
    if (!directory) {
        return null;
    }

    if (typeof directory === "string") {
        return sanitizeDirectoryString(directory);
    }

    if (typeof directory === "object" && typeof directory.uri === "string") {
        return sanitizeDirectoryString(directory.uri);
    }

    return null;
}

function sanitizeDirectoryString(value: string): string {
    if (value.length === 0) {
        return value;
    }

    if (value.startsWith("file://")) {
        return fileUriToPath(value);
    }

    return value;
}

function fileUriToPath(uri: string): string {
    try {
        const url = new URL(uri);
        if (url.protocol === "file:") {
            return decodeURI(url.pathname);
        }
    } catch {
        // Ignore parse errors and fall through to returning the original string.
    }
    return uri;
}

function ensureModuleAvailable<T>(method: T | undefined, methodName: string): method is T {
    if (typeof method === "function") {
        return true;
    }

    if (__DEV__) {
        console.warn(`FileDialog native method ${methodName} is not available`);
    }

    return false;
}

export async function openFileDialog(options: FileDialogOpenOptions = {}): Promise<string[] | null> {
    if (Platform.OS !== "macos") {
        return null;
    }

    const openMethod = NativeFileDialog.open;
    if (!ensureModuleAvailable(openMethod, "open")) {
        return null;
    }

    const directoryURL = resolveDirectory(options.directoryURL);

    return openMethod({
        canChooseFiles: options.canChooseFiles,
        canChooseDirectories: options.canChooseDirectories,
        allowsMultipleSelection: options.allowsMultipleSelection,
        directoryURL,
    });
}

export async function saveFileDialog(options: FileDialogSaveOptions = {}): Promise<string | null> {
    if (Platform.OS !== "macos") {
        return null;
    }

    const saveMethod = NativeFileDialog.save;
    if (!ensureModuleAvailable(saveMethod, "save")) {
        return null;
    }

    const directoryURL = resolveDirectory(options.directoryURL);

    return saveMethod({
        suggestedFileName: options.suggestedFileName,
        directoryURL,
    });
}

export async function selectDirectory(options: { directoryURL?: DirectoryLike } = {}): Promise<string | null> {
    const result = await openFileDialog({
        canChooseFiles: false,
        canChooseDirectories: true,
        allowsMultipleSelection: false,
        directoryURL: options.directoryURL ?? defaultDirectoryPath,
    });

    return Array.isArray(result) && result.length > 0 ? result[0] : null;
}
