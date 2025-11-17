import { Platform } from "react-native";
import AudioPlayer, { type MediaTagWritePayload } from "@/native-modules/AudioPlayer";

export const isNativeID3WriterAvailable =
    Platform.OS === "macos" && typeof (AudioPlayer as { writeMediaTags?: unknown }).writeMediaTags === "function";

export async function writeNativeID3Tags(
    filePath: string,
    payload: MediaTagWritePayload,
): Promise<{ success: boolean }> {
    if (!isNativeID3WriterAvailable) {
        console.warn("Native ID3 writer is not available on this platform");
        return { success: false };
    }

    try {
        const result = await AudioPlayer.writeMediaTags(filePath, payload);
        return { success: result?.success === true };
    } catch (error) {
        console.error("Failed to write ID3 tags natively", error);
        return { success: false };
    }
}
