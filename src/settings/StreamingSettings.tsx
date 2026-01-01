import { useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { audioControls } from "@/components/AudioPlayer";
import { showToast } from "@/components/Toast";
import { providerSettings$, setActiveProvider } from "@/providers/providerRegistry";
import { completeSpotifyLogin, logoutSpotify, spotifyAuthState$, startSpotifyLogin } from "@/providers/spotify";
import { searchSpotifyTracks } from "@/providers/spotify/search";
import type { ProviderTrack } from "@/providers/types";
import { SettingsPage, SettingsRow, SettingsSection } from "@/settings/components";
import { formatSecondsToMmSs } from "@/utils/m3u";

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

export function StreamingSettings() {
    const auth = useValue(spotifyAuthState$);
    const providerSettings = useValue(providerSettings$);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<ProviderTrack[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleAuthUrl = useCallback(async (url: string) => {
        const { code, state } = parseAuthParams(url);
        console.log("auth url", url, code, state);
        if (!code || !state) {
            return;
        }

        try {
            await completeSpotifyLogin({ code, state });
            showToast("Spotify connected", "success");
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
        setActiveProvider(enabled ? "spotify" : "local");
    }, []);

    const handleSearch = useCallback(async () => {
        if (!isSpotifyEnabled) {
            return;
        }

        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        try {
            setIsSearching(true);
            const tracks = await searchSpotifyTracks(searchQuery.trim(), 12);
            setSearchResults(tracks);
        } catch (error) {
            console.error("Spotify search failed", error);
            showToast(error instanceof Error ? error.message : "Spotify search failed", "error");
        } finally {
            setIsSearching(false);
        }
    }, [isSpotifyEnabled, searchQuery]);

    const queueSpotifyTrack = useCallback((track: ProviderTrack) => {
        const durationSeconds = track.durationMs ? track.durationMs / 1000 : 0;
        const durationString = durationSeconds ? formatSecondsToMmSs(durationSeconds) : " ";
        const localTrack = {
            id: track.uri ?? track.id,
            title: track.name,
            artist: (track.artists ?? []).join(", "),
            album: track.album,
            duration: durationString,
            filePath: track.uri ?? track.id,
            fileName: track.name,
            thumbnail: track.thumbnail,
            provider: "spotify",
            uri: track.uri,
            durationMs: track.durationMs,
            isMissing: false,
        };
        audioControls.queue.append(localTrack, { playImmediately: true });
        showToast(`Queued ${track.name}`, "success");
    }, []);

    return (
        <SettingsPage>
            <SettingsSection
                title="Spotify"
                description="Enable or disable Spotify playback and search."
                first
            >
                <SettingsRow
                    title="Enable Spotify"
                    description="Use Spotify as the active streaming provider."
                    control={<Checkbox checked={isSpotifyEnabled} onChange={handleSpotifyToggle} />}
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
                            : isAuthenticated
                              ? "Spotify is connected and ready for playback."
                              : "Connect a Spotify Premium account to enable streaming."
                    }
                    control={
                        <View className="flex flex-row flex-wrap gap-2">
                            <Button
                                variant="primary"
                                size="medium"
                                disabled={isLoggingIn || !isSpotifyEnabled}
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

            <SettingsSection
                title="Spotify Search"
                description="Search Spotify tracks and enqueue them. Requires Spotify login and Premium for playback."
                contentClassName="gap-4"
            >
                <SettingsRow
                    title="Search"
                    description="Find tracks by song or artist."
                    control={
                        <View className="flex flex-row items-center gap-2">
                            <TextInput
                                className="flex-1 rounded-md border border-border-primary bg-background-tertiary px-2 py-2 text-text-primary"
                                placeholder="Search songs or artists"
                                placeholderTextColor="#9ca3af"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                editable={isSpotifyEnabled}
                            />
                            <Button
                                variant="primary"
                                size="medium"
                                disabled={isSearching || !isAuthenticated || !isSpotifyEnabled}
                                onClick={handleSearch}
                            >
                                <Text className="text-text-primary text-sm font-medium">
                                    {isSearching ? "Searching..." : "Search"}
                                </Text>
                            </Button>
                        </View>
                    }
                    controlWrapperClassName="ml-6 w-[360px]"
                />
                {!isSpotifyEnabled ? (
                    <View className="rounded-xl border border-border-primary bg-background-tertiary px-5 py-4">
                        <Text className="text-sm text-text-tertiary">Enable Spotify to search.</Text>
                    </View>
                ) : searchResults.length === 0 ? (
                    <View className="rounded-xl border border-border-primary bg-background-tertiary px-5 py-4">
                        <Text className="text-sm text-text-tertiary">No results yet</Text>
                    </View>
                ) : (
                    searchResults.map((track) => (
                        <SettingsRow
                            key={track.uri ?? track.id}
                            title={track.name}
                            description={(track.artists ?? []).join(", ")}
                            control={
                                <View className="flex-row items-center gap-2">
                                    {track.durationMs ? (
                                        <Text className="text-xs text-text-tertiary">
                                            {formatSecondsToMmSs(track.durationMs / 1000)}
                                        </Text>
                                    ) : null}
                                    <Button variant="secondary" size="medium" onClick={() => queueSpotifyTrack(track)}>
                                        <Text className="text-text-primary text-sm font-medium">Queue</Text>
                                    </Button>
                                </View>
                            }
                        />
                    ))
                )}
            </SettingsSection>
        </SettingsPage>
    );
}
