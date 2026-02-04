import { useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { queue$, queueControls } from "@/components/AudioPlayer";
import { Button } from "@/components/Button";
import { DropdownMenu } from "@/components/DropdownMenu";
import { TextInputMac, type TextInputMacRef } from "@/components/TextInputMac";
import { SegmentedButtons } from "@/components/SegmentedButtons";
import { showToast } from "@/components/Toast";
import type { StreamingProviderId } from "@/providers/types";
import { finishAiPlaylistFill, finishAiQueueFill, startAiPlaylistFill, startAiQueueFill } from "@/systems/ai";
import { aiGenerationPopup$ } from "@/systems/ai/generationPopup";
import { extendLocalPlaylistWithPrompt } from "@/systems/ai/playlistExtend";
import { type AiPromptSource, getAiPromptPlaceholder } from "@/systems/ai/promptSource";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { settings$ } from "@/systems/Settings";
import { fetchSuggestions, selectedSuggestionProviderId$, suggestionProviderAvailability$ } from "@/systems/suggestions";
import { useWindowId } from "@/windows/WindowProvider";
import { useCurrentWindowDimensions } from "@/windows/windowDimensions";

const DEFAULT_COUNT = 20;
const MIN_COUNT = 1;
const MAX_COUNT = 100;

type QueueAiFrom = "local-library" | "spotify" | "appleMusic" | "youtubeMusic";

const getPromptSourceForFrom = (from: QueueAiFrom): AiPromptSource =>
    from === "local-library" ? "local-library" : "streaming";

const getTrackProviderOverrideForFrom = (from: QueueAiFrom): StreamingProviderId | null =>
    from === "local-library" ? null : (from as StreamingProviderId);

const clampCount = (value: number): number => Math.max(MIN_COUNT, Math.min(MAX_COUNT, value));

const coerceQueueFrom = (value?: string | null): QueueAiFrom => {
    if (value === "local-library" || value === "spotify" || value === "appleMusic" || value === "youtubeMusic") {
        return value;
    }
    return "spotify";
};

export function AiGenerationPopupHost() {
    const isOpen$ = aiGenerationPopup$.isOpen;
    const isOpen = useValue(isOpen$);
    const title = useValue(aiGenerationPopup$.title);
    const action = useValue(aiGenerationPopup$.action);
    const seedTracks = useValue(aiGenerationPopup$.seedTracks);
    const targetPlaylistId = useValue(aiGenerationPopup$.targetPlaylistId);
    const anchorRect = useValue(aiGenerationPopup$.anchorRect);
    const initialProviderId = useValue(aiGenerationPopup$.initialProviderId);
    const initialPromptSource = useValue(aiGenerationPopup$.initialPromptSource);
    const targetWindowId = useValue(aiGenerationPopup$.windowId);

    const { width: windowWidth, height: windowHeight } = useCurrentWindowDimensions();

    const [prompt, setPrompt] = useState("");
    const windowId = useWindowId();
    const isVisible = isOpen && targetWindowId === windowId;
    const settingsPromptSource = useValue(settings$.ai.promptSource);
    const settingsPreferredTrackProviderId = useValue(settings$.ai.preferredTrackProviderId);
    const defaultProviderId = useValue(selectedSuggestionProviderId$);
    const providerAvailability = useValue(suggestionProviderAvailability$);
    const queueTracks = useValue(queue$.tracks);
    const playlists = useValue(localMusicState$.playlists);

    const [providerId, setProviderId] = useState<"claude" | "codex" | "spotify">(defaultProviderId);
    const [from, setFrom] = useState<QueueAiFrom>("spotify");
    const promptSource = useMemo(() => getPromptSourceForFrom(from), [from]);
    const trackProviderIdOverride = useMemo(() => getTrackProviderOverrideForFrom(from), [from]);
    const targetPlaylist = useMemo(() => {
        if (!targetPlaylistId) {
            return null;
        }
        return playlists.find((playlist) => playlist.id === targetPlaylistId) ?? null;
    }, [playlists, targetPlaylistId]);

    const [countText, setCountText] = useState(String(DEFAULT_COUNT));
    const count = useMemo(() => {
        const parsed = Number.parseInt(countText, 10);
        if (!Number.isFinite(parsed)) {
            return DEFAULT_COUNT;
        }
        return clampCount(parsed);
    }, [countText]);

    const [isRunning, setIsRunning] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const textInputRef = useRef<TextInputMacRef>(null);

    const isProviderAvailable = providerAvailability[providerId] ?? false;
    const anyProviderAvailable = Boolean(
        providerAvailability.claude || providerAvailability.codex || providerAvailability.spotify,
    );
    const aiSettings = useValue(settings$.ai);
    const isFeatureEnabled = aiSettings.enabled;
    const isDisabled = !anyProviderAvailable || !isFeatureEnabled;

    const close = useCallback(() => {
        isOpen$.set(false);
    }, [isOpen$]);

    const confirmReplaceQueue = useCallback(async (): Promise<boolean> => {
        if (queueTracks.length === 0) {
            return true;
        }

        return await new Promise((resolve) => {
            Alert.alert(
                "Replace queue?",
                "This will replace your current queue.",
                [
                    { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                    { text: "Replace", style: "destructive", onPress: () => resolve(true) },
                ],
                { cancelable: true, onDismiss: () => resolve(false) },
            );
        });
    }, [queueTracks.length]);

    const canRun = useMemo(() => {
        if (isDisabled || isRunning || !isProviderAvailable) {
            return false;
        }

        if (action === "generate-queue" || action === "extend-playlist") {
            if (prompt.trim().length === 0) {
                return false;
            }
            if (action === "extend-playlist" && !targetPlaylist) {
                return false;
            }
            return true;
        }

        return seedTracks.length > 0;
    }, [action, isDisabled, isProviderAvailable, isRunning, prompt, seedTracks.length, targetPlaylist]);

    const handleRun = useCallback(async () => {
        if (!canRun) {
            return;
        }

        const trimmedPrompt = prompt.trim();
        const replaceQueue = action === "generate-queue" || action === "start-mix";
        if (replaceQueue) {
            const confirmed = await confirmReplaceQueue();
            if (!confirmed) {
                return;
            }
        }

        setErrorMessage(null);
        setIsRunning(true);
        const isPlaylistExtension = action === "extend-playlist";
        if (isPlaylistExtension) {
            if (targetPlaylist) {
                startAiPlaylistFill(targetPlaylist.id);
            }
        } else {
            startAiQueueFill();
        }

        try {
            close();

            if (action === "extend-playlist") {
                if (!targetPlaylist) {
                    setErrorMessage("Select a local playlist to extend.");
                    isOpen$.set(true);
                    return;
                }

                const { addedPaths, playlist, unresolved } = await extendLocalPlaylistWithPrompt(
                    targetPlaylist,
                    trimmedPrompt,
                    {
                        count,
                        promptSource,
                        providerIdOverride: providerId,
                        trackProviderIdOverride,
                        updateMetadata: true,
                    },
                );

                const addedLabel = addedPaths.length === 1 ? "track" : "tracks";
                showToast(`Added ${addedPaths.length} ${addedLabel} to ${playlist.name}`, "info");
                if (unresolved && unresolved.length > 0) {
                    showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
                }
                return;
            }

            if (action === "generate-queue") {
                const { tracks, unresolved } = await fetchSuggestions({
                    providerIdOverride: providerId,
                    trackProviderIdOverride,
                    mode: "playlist",
                    prompt: trimmedPrompt,
                    count,
                    promptSource,
                    cachePrompt: trimmedPrompt,
                });

                if (tracks.length === 0) {
                    setErrorMessage("No tracks were suggested.");
                    isOpen$.set(true);
                    return;
                }

                queueControls.replace(tracks);
                const trackLabel = tracks.length === 1 ? "track" : "tracks";
                showToast(`Created queue with ${tracks.length} ${trackLabel}`, "info");
                if (unresolved && unresolved.length > 0) {
                    showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
                }
                return;
            }

            const extensionSeedTracks = seedTracks;
            if (extensionSeedTracks.length === 0) {
                setErrorMessage("Select at least one seed track.");
                isOpen$.set(true);
                return;
            }

            if (action === "start-mix") {
                queueControls.replace([extensionSeedTracks[0]]);
            }

            const excludeTrackIds = action === "add-more-like-this" ? queueTracks.map((track) => track.id) : undefined;
            const { tracks, unresolved } = await fetchSuggestions({
                providerIdOverride: providerId,
                trackProviderIdOverride,
                mode: "queue-extension",
                source: "manual",
                promptSource,
                seedTracks: extensionSeedTracks,
                count,
                prompt: trimmedPrompt || undefined,
                excludeTrackIds,
            });

            if (tracks.length === 0) {
                showToast("No tracks were suggested.", "error");
                return;
            }

            queueControls.append(tracks);
            const addedLabel = tracks.length === 1 ? "track" : "tracks";
            showToast(`Added ${tracks.length} ${addedLabel} to the queue`, "info");
            if (unresolved && unresolved.length > 0) {
                showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
            }
        } catch (error) {
            console.error("AI generation failed", error);
            const message = error instanceof Error ? error.message : "AI generation failed";
            if (action === "extend-playlist") {
                setErrorMessage(message);
                isOpen$.set(true);
            } else {
                showToast(message, "error");
            }
        } finally {
            setIsRunning(false);
            if (action === "extend-playlist") {
                finishAiPlaylistFill();
            } else {
                finishAiQueueFill();
            }
        }
    }, [
        action,
        canRun,
        close,
        confirmReplaceQueue,
        count,
        extendLocalPlaylistWithPrompt,
        isOpen$,
        prompt,
        promptSource,
        providerId,
        queueTracks,
        seedTracks,
        targetPlaylist,
        trackProviderIdOverride,
    ]);

    const resolveDefaultFrom = useCallback((): QueueAiFrom => {
        if (initialPromptSource === "local-library") {
            return "local-library";
        }

        if (initialPromptSource === "streaming") {
            if (
                settingsPreferredTrackProviderId === "spotify" ||
                settingsPreferredTrackProviderId === "appleMusic" ||
                settingsPreferredTrackProviderId === "youtubeMusic"
            ) {
                return settingsPreferredTrackProviderId as QueueAiFrom;
            }

            return "spotify";
        }

        if (settingsPromptSource === "local-library") {
            return "local-library";
        }

        if (
            settingsPreferredTrackProviderId === "spotify" ||
            settingsPreferredTrackProviderId === "appleMusic" ||
            settingsPreferredTrackProviderId === "youtubeMusic"
        ) {
            return settingsPreferredTrackProviderId as QueueAiFrom;
        }

        return "spotify";
    }, [initialPromptSource, settingsPreferredTrackProviderId, settingsPromptSource]);

    useEffect(() => {
        if (!isVisible) {
            return;
        }

        setPrompt("");
        setErrorMessage(null);
        setCountText(String(DEFAULT_COUNT));
        setFrom(resolveDefaultFrom());
        setProviderId(initialProviderId ?? defaultProviderId);

        setTimeout(() => {
            textInputRef.current?.focus();
        }, 0);
    }, [defaultProviderId, initialProviderId, isVisible, resolveDefaultFrom]);

    const placeholder = useMemo(() => {
        const mode = action === "extend-playlist" ? "playlist" : "queue";
        return getAiPromptPlaceholder(promptSource, mode);
    }, [action, promptSource]);

    const effectiveAnchorRect = useMemo(() => {
        if (anchorRect) {
            return anchorRect;
        }

        return {
            screenX: Math.max(8, Math.round(windowWidth / 2)),
            screenY: Math.max(8, Math.round(windowHeight / 3)),
            width: 1,
            height: 1,
        };
    }, [anchorRect, windowHeight, windowWidth]);

    if (!isVisible) {
        return null;
    }

    return (
        <DropdownMenu.Root isOpen$={isOpen$}>
            <DropdownMenu.Content
                anchorRect={effectiveAnchorRect}
                directionalHint="topCenter"
                minWidth={360}
                maxWidth={360}
                setInitialFocus
                scrolls={false}
            >
                <View className="p-3 bg-background-tertiary border border-border-primary rounded-md gap-2">
                    <Text className="text-text-primary text-sm font-semibold">{title}</Text>
                    <View className="gap-1">
                        <Text className="text-text-secondary text-xs font-medium">From</Text>
                        <SegmentedButtons
                            value={from}
                            options={[
                                { value: "local-library", label: "Library", disabled: providerId === "spotify" },
                                { value: "spotify", label: "Spotify" },
                                { value: "appleMusic", label: "Apple Music", disabled: providerId === "spotify" },
                                { value: "youtubeMusic", label: "YouTube Music", disabled: providerId === "spotify" },
                            ]}
                            onValueChange={(value) => setFrom(coerceQueueFrom(value))}
                        />
                    </View>
                    <View className="gap-1">
                        <Text className="text-text-secondary text-xs font-medium">With</Text>
                        <SegmentedButtons
                            value={providerId}
                            options={[
                                { value: "claude", label: "Claude", disabled: !providerAvailability.claude },
                                { value: "codex", label: "Codex", disabled: !providerAvailability.codex },
                                { value: "spotify", label: "Spotify", disabled: !providerAvailability.spotify },
                            ]}
                            onValueChange={(value) => {
                                if (value === "spotify") {
                                    setFrom("spotify");
                                }
                                setProviderId(value);
                            }}
                        />
                    </View>
                    <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-text-secondary text-xs font-medium">Number</Text>
                        <View className="bg-background-secondary border border-border-primary rounded-md px-3 w-20 h-8 justify-center">
                            <TextInputMac
                                value={countText}
                                onChangeText={(value) => {
                                    const digits = value.replace(/[^\d]/g, "");
                                    setCountText(digits.length > 0 ? digits : "");
                                }}
                                onBlur={() => {
                                    setCountText(String(count));
                                }}
                                placeholder={String(DEFAULT_COUNT)}
                                placeholderTextColor="#6b7280"
                                fontSize={14}
                                className="text-text-primary"
                            />
                        </View>
                    </View>
                    <View className="bg-background-secondary border border-border-primary rounded-md px-3 py-2">
                        <TextInputMac
                            ref={textInputRef}
                            value={prompt}
                            onChangeText={(value) => {
                                setPrompt(value);
                                if (errorMessage) {
                                    setErrorMessage(null);
                                }
                            }}
                            placeholder={placeholder}
                            placeholderTextColor="#6b7280"
                            fontSize={14}
                            multiline
                            className="text-text-primary"
                            style={{ minHeight: 64 }}
                        />
                    </View>
                    {errorMessage ? (
                        <View className="rounded-md border border-border-primary/60 bg-red-500/10 px-3 py-2">
                            <Text className="text-sm text-red-200">{errorMessage}</Text>
                        </View>
                    ) : null}
                    <View className="flex-row justify-end gap-2">
                        <Button variant="secondary" size="small" onClick={close}>
                            <Text className="text-white text-sm">Cancel</Text>
                        </Button>
                        <Button variant="primary" size="small" onClick={handleRun} disabled={!canRun}>
                            <Text className="text-white text-sm font-medium">
                                {isRunning ? "Generating..." : "Generate"}
                            </Text>
                        </Button>
                    </View>
                </View>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}
