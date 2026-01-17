import { useValue } from "@legendapp/state/react";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { showToast } from "@/components/Toast";
import { authorizeAppleMusic, logoutAppleMusic } from "@/providers/appleMusic/auth";
import {
    appleMusicAuthState$,
    hasAppleMusicDeveloperToken$,
    isAppleMusicAuthorized$,
} from "@/providers/appleMusic/authState";
import { providerSettings$, setActiveProvider } from "@/providers/providerRegistry";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";

export function AppleMusicSettings() {
    const providerSettings = useValue(providerSettings$);
    const auth = useValue(appleMusicAuthState$);
    const hasDeveloperToken = useValue(hasAppleMusicDeveloperToken$);
    const isAuthorized = useValue(isAppleMusicAuthorized$);
    const activeProvider = providerSettings.activeProviderId;
    const isAppleMusicEnabled = activeProvider === "appleMusic";
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleAppleMusicToggle = useCallback((enabled: boolean) => {
        setActiveProvider(enabled ? "appleMusic" : "local");
    }, []);

    const handleLogin = useCallback(async () => {
        try {
            setIsLoggingIn(true);
            await authorizeAppleMusic();
            showToast("Apple Music connected", "info");
        } catch (error) {
            console.error("Apple Music login failed", error);
            showToast(error instanceof Error ? error.message : "Apple Music login failed", "error");
        } finally {
            setIsLoggingIn(false);
        }
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await logoutAppleMusic();
            showToast("Logged out of Apple Music");
        } catch (error) {
            console.error("Failed to logout Apple Music", error);
            showToast(error instanceof Error ? error.message : "Failed to logout Apple Music", "error");
        }
    }, []);

    const displayName = auth.user?.name ?? auth.user?.id ?? "Apple Music";

    return (
        <SettingsPage>
            <SettingsSection title="Apple Music" description="Enable Apple Music playback and search." first>
                <SettingsRow
                    title="Enable Apple Music"
                    description="Use Apple Music as the active streaming provider."
                    control={<Checkbox checked={isAppleMusicEnabled} onChange={handleAppleMusicToggle} />}
                />
                <SettingsRow
                    title="Developer Token"
                    description="Requires a backend endpoint to provide a MusicKit developer token."
                    control={
                        <View className="items-end gap-1">
                            <Text className="text-sm text-text-secondary">
                                {!isAppleMusicEnabled
                                    ? "Apple Music is disabled."
                                    : hasDeveloperToken
                                      ? "Developer token fetched."
                                      : "Missing developer token."}
                            </Text>
                        </View>
                    }
                    controlWrapperClassName="ml-6"
                />
            </SettingsSection>
            <SettingsSection
                title="Apple Music Account"
                description="Sign in to access your library and enable full playback."
            >
                <SettingsRow
                    title="Connection"
                    description={
                        !isAppleMusicEnabled
                            ? "Enable Apple Music to connect your account."
                            : !hasDeveloperToken
                              ? "Developer token required before sign-in."
                              : isAuthorized
                                ? "Apple Music is connected and ready for playback."
                                : "Connect an Apple Music account to enable streaming."
                    }
                    control={
                        <View className="flex flex-row flex-wrap gap-2">
                            <Button
                                variant="primary"
                                size="medium"
                                disabled={isLoggingIn || !isAppleMusicEnabled || !hasDeveloperToken}
                                onClick={handleLogin}
                            >
                                <Text className="text-text-primary text-sm font-medium">
                                    {isAuthorized ? "Re-authenticate" : "Sign in to Apple Music"}
                                </Text>
                            </Button>
                            <Button
                                variant="secondary"
                                size="medium"
                                onClick={handleLogout}
                                disabled={!isAuthorized}
                            >
                                <Text className="text-text-primary text-sm font-medium">Log out</Text>
                            </Button>
                        </View>
                    }
                    controlWrapperClassName="ml-6"
                />
                <SettingsRow
                    title="Account status"
                    description="Current account details from Apple Music."
                    control={
                        <View className="items-end gap-1">
                            <Text className="text-sm text-text-secondary">
                                {!isAppleMusicEnabled
                                    ? "Apple Music is disabled."
                                    : isAuthorized
                                      ? `Signed in as ${displayName}`
                                      : "Not signed in"}
                            </Text>
                            {isAppleMusicEnabled && auth.user?.subscription ? (
                                <Text className="text-sm text-text-secondary">Plan: {auth.user.subscription}</Text>
                            ) : null}
                            {isAppleMusicEnabled && auth.userTokenExpiresAt ? (
                                <Text className="text-xs text-text-tertiary">
                                    Token expires: {new Date(auth.userTokenExpiresAt).toLocaleTimeString()}
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
