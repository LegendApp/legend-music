import { useObservable, useValue } from "@legendapp/state/react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { queue$, queueControls } from "@/components/AudioPlayer";
import { Button } from "@/components/Button";
import { DropdownMenu, type DropdownMenuRootRef } from "@/components/DropdownMenu";
import { SegmentedButtons } from "@/components/SegmentedButtons";
import { showToast } from "@/components/Toast";
import type { StreamingProviderId } from "@/providers/types";
import { finishAiQueueFill, startAiQueueFill } from "@/systems/ai";
import { type AiPromptSource, getAiPromptPlaceholder } from "@/systems/ai/promptSource";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import { settings$ } from "@/systems/Settings";
import {
    fetchSuggestions,
    selectedSuggestionProviderId$,
    suggestionProviderAvailability$,
} from "@/systems/suggestions";

const DEFAULT_QUEUE_TRACK_COUNT = 20;

type QueueAiFrom = "local-library" | "spotify" | "appleMusic" | "youtubeMusic";

type QueueAiDropdownProps = {
    disabled?: boolean;
};

const getPromptSourceForFrom = (from: QueueAiFrom): AiPromptSource =>
    from === "local-library" ? "local-library" : "streaming";

const getTrackProviderOverrideForFrom = (from: QueueAiFrom): StreamingProviderId | null =>
    from === "local-library" ? null : (from as StreamingProviderId);

export const QueueAiDropdown = forwardRef<DropdownMenuRootRef, QueueAiDropdownProps>(function QueueAiDropdown(
    { disabled = false },
    ref,
) {
    const isOpen$ = useObservable(false);
    const isOpen = useValue(isOpen$);
    const [prompt, setPrompt] = useState("");
    const settingsPromptSource = useValue(settings$.ai.promptSource);
    const settingsPreferredTrackProviderId = useValue(settings$.ai.preferredTrackProviderId);
    const defaultProviderId = useValue(selectedSuggestionProviderId$);
    const [providerId, setProviderId] = useState<"claude" | "codex" | "spotify">(defaultProviderId);
    const [from, setFrom] = useState<QueueAiFrom>("spotify");
    const promptSource = useMemo(() => getPromptSourceForFrom(from), [from]);
    const trackProviderIdOverride = useMemo(() => getTrackProviderOverrideForFrom(from), [from]);
    const [isCreating, setIsCreating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const textInputRef = useRef<TextInput>(null);
    const reopenAfterErrorRef = useRef(false);
    const providerAvailability = useValue(suggestionProviderAvailability$);
    const isProviderAvailable = providerAvailability[providerId] ?? false;
    const anyProviderAvailable = Boolean(
        providerAvailability.claude || providerAvailability.codex || providerAvailability.spotify,
    );
    const aiSettings = useValue(settings$.ai);
    const isFeatureEnabled = aiSettings.enabled;
    const isDisabled = disabled || !anyProviderAvailable || !isFeatureEnabled;
    const queue = useValue(queue$);
    const queueTracks = queue.tracks;

    const close = useCallback(() => {
        isOpen$.set(false);
    }, [isOpen$]);

    const hasPrompt = prompt.trim().length > 0;
    const canCreate = !isCreating && !isDisabled && isProviderAvailable && hasPrompt;

    const reopenWithError = useCallback(
        (message: string) => {
            setErrorMessage(message);
            reopenAfterErrorRef.current = true;
            isOpen$.set(true);
        },
        [isOpen$],
    );

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

    const handleCreate = useCallback(async () => {
        if (!canCreate) {
            return;
        }

        const trimmedPrompt = prompt.trim();
        const confirmed = await confirmReplaceQueue();
        if (!confirmed) {
            return;
        }

        setErrorMessage(null);
        setIsCreating(true);
        startAiQueueFill();
        try {
            close();
            const { tracks, unresolved } = await fetchSuggestions({
                providerIdOverride: providerId,
                trackProviderIdOverride,
                mode: "playlist",
                prompt: trimmedPrompt,
                count: DEFAULT_QUEUE_TRACK_COUNT,
                promptSource,
                cachePrompt: trimmedPrompt,
            });

            if (tracks.length === 0) {
                reopenWithError("No tracks were suggested.");
                return;
            }

            queueControls.replace(tracks);

            const trackLabel = tracks.length === 1 ? "track" : "tracks";
            showToast(`Created playlist with ${tracks.length} ${trackLabel}`, "info");
            if (unresolved && unresolved.length > 0) {
                showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
            }
        } catch (error) {
            console.error("AI queue creation failed", error);
            const message = error instanceof Error ? error.message : "Failed to create AI queue";
            reopenWithError(message);
        } finally {
            setIsCreating(false);
            finishAiQueueFill();
        }
    }, [
        canCreate,
        close,
        confirmReplaceQueue,
        prompt,
        promptSource,
        providerId,
        reopenWithError,
        trackProviderIdOverride,
    ]);

    const openAiQueue = useCallback(() => {
        if (isDisabled) {
            return;
        }

        isOpen$.set(true);
    }, [isDisabled, isOpen$]);

    const hotkeyHandlers = useMemo(() => ({ AiQueue: openAiQueue }), [openAiQueue]);
    useOnHotkeys(hotkeyHandlers);

    const resolveDefaultFrom = useCallback((): QueueAiFrom => {
        if (settingsPromptSource === "local-library") {
            return "local-library";
        }

        if (
            settingsPreferredTrackProviderId === "spotify" ||
            settingsPreferredTrackProviderId === "appleMusic" ||
            settingsPreferredTrackProviderId === "youtubeMusic"
        ) {
            return settingsPreferredTrackProviderId;
        }

        return "spotify";
    }, [settingsPreferredTrackProviderId, settingsPromptSource]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (reopenAfterErrorRef.current) {
            reopenAfterErrorRef.current = false;
        } else {
            const nextFrom = resolveDefaultFrom();
            setPrompt("");
            setErrorMessage(null);
            setFrom(nextFrom);
            setProviderId(defaultProviderId);
        }

        setTimeout(() => {
            textInputRef.current?.focus();
        }, 0);
    }, [defaultProviderId, isOpen, resolveDefaultFrom]);

    const defaultPromptForSource = useMemo(() => getAiPromptPlaceholder(promptSource, "queue"), [promptSource]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        return KeyboardManager.addKeyDownListener((event) => {
            if (event.keyCode === KeyCodes.KEY_ESCAPE) {
                close();
                return true;
            }

            if (event.keyCode === KeyCodes.KEY_RETURN) {
                if (canCreate) {
                    void handleCreate();
                    return true;
                }
            }

            return false;
        });
    }, [canCreate, close, handleCreate, isOpen]);

    return (
        <DropdownMenu.Root ref={ref} isOpen$={isOpen$}>
            <DropdownMenu.Trigger asChild disabled={isDisabled}>
                <Button
                    icon="sparkles"
                    variant="icon-hover"
                    size="xs"
                    iconSize={14}
                    accessibilityLabel="Generate queue"
                    tooltip="AI queue (a)"
                    disabled={isDisabled}
                    className="opacity-60 hover:opacity-100"
                />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
                directionalHint="topCenter"
                minWidth={360}
                maxWidth={360}
                setInitialFocus
                scrolls={false}
            >
                <View className="p-3 bg-background-tertiary border border-border-primary rounded-md gap-2">
                    <Text className="text-text-secondary text-xs font-medium">
                        Generate queue with{" "}
                        {providerId === "claude" ? "Claude" : providerId === "codex" ? "Codex" : "Spotify"}
                    </Text>
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
                            onValueChange={(value) => setFrom(value)}
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
                    <View className="bg-background-secondary border border-border-primary rounded-md px-3 py-2">
                        <TextInput
                            ref={textInputRef}
                            value={prompt}
                            onChangeText={(value) => {
                                setPrompt(value);
                                if (errorMessage) {
                                    setErrorMessage(null);
                                }
                            }}
                            placeholder={defaultPromptForSource}
                            placeholderTextColor="#6b7280"
                            selectTextOnFocus
                            multiline
                            className="text-sm text-text-primary min-h-16"
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
                        <Button variant="primary" size="small" onClick={handleCreate} disabled={!canCreate}>
                            <Text className="text-white text-sm font-medium">Create Playlist</Text>
                        </Button>
                    </View>
                </View>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
});
