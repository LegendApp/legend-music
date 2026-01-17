import { useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import Config from "react-native-config";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { showToast } from "@/components/Toast";
import { providerSettings$, setActiveProvider } from "@/providers/providerRegistry";
import {
    completeYoutubeMusicLogin,
    isYoutubeMusicAuthenticated$,
    logoutYoutubeMusic,
    startYoutubeMusicLogin,
    youtubeAuthState$,
} from "@/providers/youtubeMusic";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";

const parseAuthParams = (url: string): { code?: string; state?: string } => {
    try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code") ?? undefined;
        const state = parsed.searchParams.get("state") ?? undefined;
        return { code, state };
    } catch (error) {
        console.warn("Failed to parse YouTube auth callback url", error);
        return {};
    }
};

export function YoutubeMusicSettings() {
    const providerSettings = useValue(providerSettings$);
    const auth = useValue(youtubeAuthState$);
    const activeProvider = providerSettings.activeProviderId;
    const isYoutubeMusicEnabled = activeProvider === "youtubeMusic";
    const hasYoutubeMusicClientId = Boolean((Config.YOUTUBE_CLIENT_ID ?? "").trim());
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const isAuthenticated = useValue(isYoutubeMusicAuthenticated$);
    const displayName = auth.user?.displayName ?? auth.user?.email ?? auth.user?.id ?? "Unknown";

    const handleYoutubeMusicToggle = useCallback((enabled: boolean) => {
        setActiveProvider(enabled ? "youtubeMusic" : "local");
    }, []);

    const handleAuthUrl = useCallback(async (url: string) => {
        const { code, state } = parseAuthParams(url);
        if (!code || !state) {
            return;
        }

        try {
            await completeYoutubeMusicLogin({ code, state });
            showToast("YouTube Music connected", "info");
            setIsLoggingIn(false);
        } catch (error) {
            console.error("YouTube Music login failed", error);
            showToast(error instanceof Error ? error.message : "YouTube Music login failed", "error");
            setIsLoggingIn(false);
        }
    }, []);

    useEffect(() => {
        const subscription = Linking.addEventListener("url", (event) => handleAuthUrl(event.url));
        void Linking.getInitialURL().then((url) => {
            if (url) {
                handleAuthUrl(url);
            }
        });
        return () => subscription.remove();
    }, [handleAuthUrl]);

    const handleLogin = useCallback(async () => {
        try {
            setIsLoggingIn(true);
            const { authorizeUrl } = await startYoutubeMusicLogin();
            await Linking.openURL(authorizeUrl);
        } catch (error) {
            console.error("Failed to start YouTube Music login", error);
            showToast(error instanceof Error ? error.message : "Failed to start YouTube Music login", "error");
            setIsLoggingIn(false);
        }
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await logoutYoutubeMusic();
            showToast("Logged out of YouTube Music");
        } catch (error) {
            console.error("Failed to logout YouTube Music", error);
            showToast(error instanceof Error ? error.message : "Failed to logout YouTube Music", "error");
        }
    }, []);

    return (
        <SettingsPage>
            <SettingsSection
                title="YouTube Music"
                description="Enable YouTube Music playback and search using the YouTube Data API."
                first
            >
                <SettingsRow
                    title="Enable YouTube Music"
                    description="Use YouTube Music as the active streaming provider."
                    control={<Checkbox checked={isYoutubeMusicEnabled} onChange={handleYoutubeMusicToggle} />}
                />
                <SettingsRow
                    title="Status"
                    description="Check if YouTube Music search is ready."
                    control={
                        <View className="items-end gap-1">
                            <Text className="text-sm text-text-secondary">
                                {!isYoutubeMusicEnabled
                                    ? "YouTube Music is disabled."
                                    : hasYoutubeMusicClientId
                                      ? "Client ID configured."
                                      : "Missing bundled client ID."}
                            </Text>
                        </View>
                    }
                    controlWrapperClassName="ml-6"
                />
            </SettingsSection>
            <SettingsSection
                title="YouTube Music Account"
                description="Connect a Google account to enable YouTube Music search."
            >
                <SettingsRow
                    title="Connection"
                    description={
                        !isYoutubeMusicEnabled
                            ? "Enable YouTube Music to connect your account."
                            : !hasYoutubeMusicClientId
                              ? "Missing YouTube client ID in the app config."
                              : isAuthenticated
                                ? "YouTube Music is connected and ready for search."
                                : "Connect a Google account to enable search."
                    }
                    control={
                        <View className="flex flex-row flex-wrap gap-2">
                            <Button
                                variant="primary"
                                size="medium"
                                disabled={isLoggingIn || !isYoutubeMusicEnabled || !hasYoutubeMusicClientId}
                                onClick={handleLogin}
                            >
                                <Text className="text-text-primary text-sm font-medium">
                                    {isAuthenticated ? "Re-authenticate" : "Log in to YouTube Music"}
                                </Text>
                            </Button>
                            <Button
                                variant="secondary"
                                size="medium"
                                onClick={handleLogout}
                                disabled={!isAuthenticated}
                            >
                                <Text className="text-text-primary text-sm font-medium">Log out</Text>
                            </Button>
                        </View>
                    }
                    controlWrapperClassName="ml-6"
                />
                <SettingsRow
                    title="Account status"
                    description="Current account details from Google."
                    control={
                        <View className="items-end gap-1">
                            <Text className="text-sm text-text-secondary">
                                {!isYoutubeMusicEnabled
                                    ? "YouTube Music is disabled."
                                    : isAuthenticated
                                      ? `Signed in as ${displayName}`
                                      : "Not signed in"}
                            </Text>
                            {isYoutubeMusicEnabled && auth.expiresAt ? (
                                <Text className="text-xs text-text-tertiary">
                                    Token expires: {new Date(auth.expiresAt).toLocaleTimeString()}
                                </Text>
                            ) : null}
                        </View>
                    }
                    controlWrapperClassName="ml-6"
                />
            </SettingsSection>
        </SettingsPage>
    );
}
