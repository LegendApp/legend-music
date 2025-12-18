import { useCallback, useEffect, useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import { showToast } from "@/components/Toast";
import { providerSettings$, setActiveProvider } from "@/providers/providerRegistry";
import { startSpotifyLogin, completeSpotifyLogin, logoutSpotify, spotifyAuthState$ } from "@/providers/spotify";
import { searchSpotifyTracks } from "@/providers/spotify/search";
import type { ProviderTrack } from "@/providers/types";
import { formatSecondsToMmSs } from "@/utils/m3u";
import { useValue } from "@legendapp/state/react";

const PROVIDER_OPTIONS = [
    { id: "local", label: "Local files" },
    { id: "spotify", label: "Spotify" },
] as const;

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

    const handleAuthUrl = useCallback(
        async (url: string) => {
            const { code, state } = parseAuthParams(url);
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
        },
        [],
    );

    useEffect(() => {
        const subscription = Linking.addEventListener("url", (event) => handleAuthUrl(event.url));
        void Linking.getInitialURL().then((url) => {
            if (url) {
                void handleAuthUrl(url);
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

    const handleProviderSelect = useCallback((providerId: (typeof PROVIDER_OPTIONS)[number]["id"]) => {
        setActiveProvider(providerId);
    }, []);

    const activeProvider = providerSettings.activeProviderId;
    const isAuthenticated = Boolean(auth.accessToken && auth.refreshToken);

    const handleSearch = useCallback(async () => {
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
    }, [searchQuery]);

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
        localAudioControls.queue.append(localTrack, { playImmediately: true });
        showToast(`Queued ${track.name}`, "success");
    }, []);

    return (
        <View className="flex-1 gap-4 px-6 py-4">
            <View className="gap-2">
                <Text className="text-lg font-semibold text-foreground-primary">Streaming providers</Text>
                <Text className="text-sm text-foreground-secondary">
                    Choose an active provider. Local files stay available; Spotify needs Premium for playback.
                </Text>
                <View className="mt-2 flex flex-row gap-2">
                    {PROVIDER_OPTIONS.map((option) => (
                        <Button
                            key={option.id}
                            variant={activeProvider === option.id ? "primary" : "secondary"}
                            onClick={() => handleProviderSelect(option.id)}
                        >
                            {option.label}
                        </Button>
                    ))}
                </View>
            </View>

            <View className="gap-2 rounded-lg bg-background-secondary/60 p-4">
                <Text className="text-base font-semibold text-foreground-primary">Spotify</Text>
                <Text className="text-sm text-foreground-secondary">
                    Login uses PKCE and the Spotify Web Playback SDK (Premium required). Redirect URI must match app
                    config.
                </Text>
                <View className="mt-2 flex flex-row gap-2">
                    <Button variant="primary" disabled={isLoggingIn} onClick={handleLogin}>
                        {isAuthenticated ? "Re-authenticate" : "Log in to Spotify"}
                    </Button>
                    <Button variant="secondary" onClick={handleLogout} disabled={!isAuthenticated}>
                        Log out
                    </Button>
                </View>
                <View className="mt-3 gap-1">
                    <Text className="text-sm text-foreground-primary">Status</Text>
                    <Text className="text-sm text-foreground-secondary">
                        {isAuthenticated
                            ? `Signed in as ${auth.user?.displayName ?? auth.user?.email ?? auth.user?.id ?? "Unknown"}`
                            : "Not signed in"}
                    </Text>
                    {auth.user?.product && (
                        <Text className="text-sm text-foreground-secondary">Plan: {auth.user.product}</Text>
                    )}
                    {auth.expiresAt && (
                        <Text className="text-xs text-foreground-tertiary">
                            Token expires: {new Date(auth.expiresAt).toLocaleTimeString()}
                        </Text>
                    )}
                </View>
            </View>

            <View className="gap-2 rounded-lg bg-background-secondary/60 p-4">
                <Text className="text-base font-semibold text-foreground-primary">Spotify search</Text>
                <Text className="text-sm text-foreground-secondary">
                    Search Spotify tracks and enqueue them. Requires Spotify login and Premium for playback.
                </Text>
                <View className="mt-2 flex flex-row items-center gap-2">
                    <TextInput
                        className="flex-1 rounded-md bg-background-tertiary px-2 py-2 text-foreground-primary"
                        placeholder="Search songs or artists"
                        placeholderTextColor="#9ca3af"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                    />
                    <Button variant="primary" disabled={isSearching || !isAuthenticated} onClick={handleSearch}>
                        {isSearching ? "Searching..." : "Search"}
                    </Button>
                </View>
                <View className="mt-3 gap-2">
                    {searchResults.length === 0 ? (
                        <Text className="text-sm text-foreground-tertiary">No results yet</Text>
                    ) : (
                        searchResults.map((track) => (
                            <View
                                key={track.uri ?? track.id}
                                className="flex flex-row items-center justify-between rounded-md bg-background-tertiary/70 px-2 py-2"
                            >
                                <View className="flex-1 pr-2">
                                    <Text className="text-sm font-semibold text-foreground-primary" numberOfLines={1}>
                                        {track.name}
                                    </Text>
                                    <Text className="text-xs text-foreground-secondary" numberOfLines={1}>
                                        {(track.artists ?? []).join(", ")}
                                    </Text>
                                </View>
                                <View className="flex-row gap-2">
                                    <Text className="text-xs text-foreground-tertiary">
                                        {track.durationMs ? formatSecondsToMmSs(track.durationMs / 1000) : ""}
                                    </Text>
                                    <Button variant="secondary" onClick={() => queueSpotifyTrack(track)}>
                                        Queue
                                    </Button>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </View>
        </View>
    );
}
