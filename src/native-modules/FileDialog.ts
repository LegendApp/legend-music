import * as FileSystem from "expo-file-system/next";
import { NativeModules, Platform } from "react-native";
import { SUPPORTED_AUDIO_EXTENSIONS } from "@/systems/audioFormats";

type DirectoryLike = string | { uri?: string } | null | undefined;

type NativeFileDialogModule = {
    open?: (options: NativeFileDialogOpenOptions) => Promise<string[] | null>;
    save?: (options: NativeFileDialogSaveOptions) => Promise<string | null>;
    revealInFinder?: (path: string) => Promise<boolean>;
};

type NativeFileDialogOpenOptions = {
    canChooseFiles?: boolean;
    canChooseDirectories?: boolean;
    allowsMultipleSelection?: boolean;
    directoryURL?: string | null;
    allowedFileTypes?: readonly string[];
};

type NativeFileDialogSaveOptions = {
    defaultName?: string;
    directory?: string;
    allowedFileTypes?: readonly string[];
};

const { FileDialog: NativeFileDialog = {} as NativeFileDialogModule } = NativeModules;

export interface FileDialogOpenOptions {
    canChooseFiles?: boolean;
    canChooseDirectories?: boolean;
    allowsMultipleSelection?: boolean;
    directoryURL?: DirectoryLike;
    allowedFileTypes?: readonly string[];
}

export interface FileDialogSaveOptions {
    defaultName?: string;
    directory?: string;
    allowedFileTypes?: readonly string[];
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

function resolveAllowedFileTypes(options: FileDialogOpenOptions): readonly string[] | undefined {
    if (options.allowedFileTypes && options.allowedFileTypes.length > 0) {
        return options.allowedFileTypes;
    }

    const allowsDirectoriesOnly = options.canChooseDirectories === true && options.canChooseFiles === false;
    if (allowsDirectoriesOnly) {
        return undefined;
    }

    return SUPPORTED_AUDIO_EXTENSIONS;
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
    const allowedFileTypes = resolveAllowedFileTypes(options);

    try {
        return await openMethod({
            canChooseFiles: options.canChooseFiles,
            canChooseDirectories: options.canChooseDirectories,
            allowsMultipleSelection: options.allowsMultipleSelection,
            directoryURL,
            allowedFileTypes,
        });
    } catch (error) {
        console.error("Failed to open file dialog", error);
        return null;
    }
}

export async function saveFileDialog(options: FileDialogSaveOptions = {}): Promise<string | null> {
    if (Platform.OS !== "macos") {
        return null;
    }

    const saveMethod = NativeFileDialog.save;
    if (!ensureModuleAvailable(saveMethod, "save")) {
        return null;
    }

    const directory = resolveDirectory(options.directory);

    try {
        return await saveMethod({
            defaultName: options.defaultName,
            directory,
            allowedFileTypes: options.allowedFileTypes,
        });
    } catch (error) {
        console.error("Failed to open save dialog", error);
        return null;
    }
}

export async function showInFinder(path?: string | null): Promise<boolean> {
    if (Platform.OS !== "macos" || !path) {
        return false;
    }

    const revealInFinderMethod = NativeFileDialog.revealInFinder;
    if (!ensureModuleAvailable(revealInFinderMethod, "revealInFinder")) {
        return false;
    }

    const resolvedPath = (() => {
        const rawPath = path.startsWith("file://") ? fileUriToPath(path) : path;
        if (!/%[0-9A-Fa-f]{2}/.test(rawPath)) {
            return rawPath;
        }
        try {
            return decodeURI(rawPath);
        } catch {
            return rawPath;
        }
    })();

    try {
        const result = await revealInFinderMethod(resolvedPath);
        return result === true;
    } catch (error) {
        console.error("Failed to reveal in Finder", error);
        return false;
    }
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
