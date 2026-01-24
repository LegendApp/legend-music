import { useValue } from "@legendapp/state/react";
import { $TextInput } from "@legendapp/state/react-native";
import { useCallback, useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { showToast } from "@/components/Toast";
import { streamingProviderSettings$, setActiveStreamingProvider } from "@/providers/streamingProviderRegistry";
import { completeSpotifyLogin, logoutSpotify, spotifyAuthState$, startSpotifyLogin } from "@/providers/spotify";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";
import { stateSaved$ } from "@/systems/State";

const parseAuthParams = (url: string): { code?: string; state?: string } => {
    try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code") ?? undefined;
        const state = parsed.searchParams.get("state") ?? undefined;
        return { code, state };
    } catch (error) {
        console.warn("Failed to parse auth callback url", error);
        return {};
    }
};

export function SpotifySettings() {
    const auth = useValue(spotifyAuthState$);
    const providerSettings = useValue(streamingProviderSettings$);
    const spotifyClientId = useValue(stateSaved$.spotifyClientId);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const hasSpotifyClientId = Boolean(spotifyClientId.trim());
    const handleAuthUrl = useCallback(async (url: string) => {
        const { code, state } = parseAuthParams(url);
        console.log("auth url", url, code, state);
        if (!code || !state) {
            return;
        }

        try {
            await completeSpotifyLogin({ code, state });
            showToast("Spotify connected", "info");
            setIsLoggingIn(false);
        } catch (error) {
            console.error("Spotify login failed", error);
            showToast(error instanceof Error ? error.message : "Spotify login failed", "error");
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
            const { authorizeUrl } = await startSpotifyLogin();
            await Linking.openURL(authorizeUrl);
        } catch (error) {
            console.error("Failed to start Spotify login", error);
            showToast(error instanceof Error ? error.message : "Failed to start Spotify login", "error");
            setIsLoggingIn(false);
        }
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await logoutSpotify();
            showToast("Logged out of Spotify");
        } catch (error) {
            console.error("Failed to logout Spotify", error);
            showToast(error instanceof Error ? error.message : "Failed to logout Spotify", "error");
        }
    }, []);

    const activeProvider = providerSettings.activeProviderId;
    const isSpotifyEnabled = activeProvider === "spotify";
    const isAuthenticated = Boolean(auth.accessToken && auth.refreshToken);
    const handleSpotifyToggle = useCallback((enabled: boolean) => {
        setActiveStreamingProvider(enabled ? "spotify" : "local");
    }, []);

    return (
        <SettingsPage>
            <SettingsSection title="Spotify" description="Enable or disable Spotify playback and search." first>
                <SettingsRow
                    title="Enable Spotify"
                    description="Use Spotify as the active streaming provider."
                    control={<Checkbox checked={isSpotifyEnabled} onChange={handleSpotifyToggle} />}
                />
                <SettingsRow
                    title="Client ID"
                    description="Create a Spotify app and paste its Client ID to enable login."
                    control={
                        <View className="flex flex-row items-center gap-2 w-full">
                            <$TextInput
                                className="flex-1 rounded-md border border-border-primary bg-background-tertiary px-2 py-2 text-text-primary"
                                placeholder="Spotify Client ID"
                                placeholderTextColor="#9ca3af"
                                $value={stateSaved$.spotifyClientId}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <Button
                                variant="secondary"
                                size="medium"
                                onClick={() => Linking.openURL("https://developer.spotify.com/dashboard")}
                            >
                                <Text className="text-text-primary text-sm font-medium">Get ID</Text>
                            </Button>
                        </View>
                    }
                    className="flex-col items-stretch gap-3"
                    contentClassName="pr-0"
                    controlWrapperClassName="ml-0 w-full"
                />
            </SettingsSection>

            <SettingsSection
                title="Spotify Account"
                description="Login uses PKCE and the Spotify Web Playback SDK (Premium required). Redirect URI must match app config."
            >
                <SettingsRow
                    title="Connection"
                    description={
                        !isSpotifyEnabled
                            ? "Enable Spotify to connect your account."
                            : !hasSpotifyClientId
                              ? "Enter your Spotify client ID above to connect your account."
                              : isAuthenticated
                                ? "Spotify is connected and ready for playback."
                                : "Connect a Spotify Premium account to enable streaming."
                    }
                    control={
                        <View className="flex flex-row flex-wrap gap-2">
                            <Button
                                variant="primary"
                                size="medium"
                                disabled={isLoggingIn || !isSpotifyEnabled || !hasSpotifyClientId}
                                onClick={handleLogin}
                            >
                                <Text className="text-text-primary text-sm font-medium">
                                    {isAuthenticated ? "Re-authenticate" : "Log in to Spotify"}
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
                    description="Current account details from Spotify."
                    control={
                        <View className="items-end gap-1">
                            <Text className="text-sm text-text-secondary">
                                {!isSpotifyEnabled
                                    ? "Spotify is disabled."
                                    : isAuthenticated
                                      ? `Signed in as ${auth.user?.displayName ?? auth.user?.email ?? auth.user?.id ?? "Unknown"}`
                                      : "Not signed in"}
                            </Text>
                            {isSpotifyEnabled && auth.user?.product ? (
                                <Text className="text-sm text-text-secondary">Plan: {auth.user.product}</Text>
                            ) : null}
                            {isSpotifyEnabled && auth.expiresAt ? (
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
