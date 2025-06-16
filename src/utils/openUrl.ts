import { Linking } from "react-native";

/**
 * Opens a URL in the default web browser
 * @param url The URL to open
 * @returns A Promise that resolves when the URL is opened
 */
export const openUrl = async (url: string): Promise<boolean> => {
    try {
        // Check if the URL can be opened
        const canOpen = await Linking.canOpenURL(url);

        if (!canOpen) {
            console.warn(`Cannot open URL: ${url}`);
            return false;
        }

        // Open the URL
        await Linking.openURL(url);
        return true;
    } catch (error) {
        console.error("Error opening URL:", error);
        return false;
    }
};
