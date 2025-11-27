export const SUPPORTED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "flac"] as const;

// AVFoundation also decodes these formats, but they are not enabled for import yet.
export const AVFOUNDATION_COMPATIBLE_EXTENSIONS = [
    ...SUPPORTED_AUDIO_EXTENSIONS,
    "aif",
    "aiff",
    "aifc",
    "caf",
] as const;

const supportedExtensionPattern = new RegExp(`\\.(${SUPPORTED_AUDIO_EXTENSIONS.join("|")})$`, "i");
const supportedExtensionsSet = new Set<string>(SUPPORTED_AUDIO_EXTENSIONS);

export function isSupportedAudioExtension(extension?: string | null): boolean {
    if (!extension) {
        return false;
    }

    return supportedExtensionsSet.has(extension.toLowerCase());
}

export function isSupportedAudioFile(path?: string | null): boolean {
    if (!path) {
        return false;
    }

    const extension = path.split(".").pop();
    return isSupportedAudioExtension(extension);
}

export function stripSupportedAudioExtension(fileName: string): string {
    if (!fileName) {
        return fileName;
    }

    return fileName.replace(supportedExtensionPattern, "");
}
