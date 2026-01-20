import { useObservable, useValue } from "@legendapp/state/react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { DropdownMenu, type DropdownMenuRootRef } from "@/components/DropdownMenu";
import { showToast } from "@/components/Toast";
import { queueControls } from "@/components/AudioPlayer";
import { fetchSuggestions, isSelectedSuggestionProviderAvailable$, selectedSuggestionProvider$ } from "@/systems/suggestions";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import { settings$ } from "@/systems/Settings";

const COUNT_OPTIONS = [10, 20, 30, 40, 50];

type QueueAiDropdownProps = {
    disabled?: boolean;
};

export const QueueAiDropdown = forwardRef<DropdownMenuRootRef, QueueAiDropdownProps>(function QueueAiDropdown(
    { disabled = false },
    ref,
) {
    const isOpen$ = useObservable(false);
    const isOpen = useValue(isOpen$);
    const [prompt, setPrompt] = useState("");
    const [count, setCount] = useState(COUNT_OPTIONS[1]);
    const [isCreating, setIsCreating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const textInputRef = useRef<TextInput>(null);
    const reopenAfterErrorRef = useRef(false);
    const selectedProvider = useValue(selectedSuggestionProvider$);
    const providerName = selectedProvider?.name ?? "AI";
    const providerAvailable = useValue(isSelectedSuggestionProviderAvailable$);
    const aiSettings = useValue(settings$.ai);
    const isFeatureEnabled = aiSettings.enabled && aiSettings.playlistCreation;
    const isDisabled = disabled || !providerAvailable || !isFeatureEnabled;

    const close = useCallback(() => {
        isOpen$.set(false);
    }, [isOpen$]);

    const canCreate = prompt.trim().length > 0 && !isCreating && !isDisabled;

    const reopenWithError = useCallback(
        (message: string) => {
            setErrorMessage(message);
            reopenAfterErrorRef.current = true;
            isOpen$.set(true);
        },
        [isOpen$],
    );

    const handleCreate = useCallback(async () => {
        if (!canCreate) {
            return;
        }

        const trimmedPrompt = prompt.trim();
        setErrorMessage(null);
        setIsCreating(true);
        try {
            close();
            const { tracks, unresolved } = await fetchSuggestions({
                mode: "playlist",
                prompt: trimmedPrompt,
                count,
            });

            if (tracks.length === 0) {
                reopenWithError("No tracks were suggested.");
                return;
            }

            queueControls.replace(tracks, { startIndex: 0 });

            const addedLabel = tracks.length === 1 ? "track" : "tracks";
            showToast(`Queued ${tracks.length} ${addedLabel}`, "info");
            if (unresolved && unresolved.length > 0) {
                showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
            }
        } catch (error) {
            console.error("AI queue creation failed", error);
            const message = error instanceof Error ? error.message : "Failed to create AI queue";
            reopenWithError(message);
        } finally {
            setIsCreating(false);
        }
    }, [canCreate, close, count, prompt, reopenWithError]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (reopenAfterErrorRef.current) {
            reopenAfterErrorRef.current = false;
        } else {
            setPrompt("");
            setErrorMessage(null);
        }

        setTimeout(() => {
            textInputRef.current?.focus();
        }, 0);
    }, [isOpen]);

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
                    variant="icon-hover"
                    size="xs"
                    accessibilityLabel={`Queue tracks with ${providerName}`}
                    tooltip="AI queue (a)"
                    disabled={isDisabled}
                >
                    <Text className="text-base">✨</Text>
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content directionalHint="topCenter" minWidth={360} maxWidth={360} setInitialFocus scrolls={false}>
                <View className="p-3 bg-background-tertiary border border-border-primary rounded-md gap-2">
                    <Text className="text-text-secondary text-xs font-medium">Queue tracks with {providerName}</Text>
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
                            placeholder="Describe the queue"
                            placeholderTextColor="#6b7280"
                            multiline
                            className="text-sm text-text-primary min-h-16"
                        />
                    </View>
                    <DropdownMenu.Root closeOnSelect>
                        <DropdownMenu.Trigger showCaret className="px-3 py-2 rounded-md bg-background-secondary">
                            <View className="flex-row items-center justify-between">
                                <Text className="text-white text-sm">Tracks</Text>
                                <Text className="text-white text-sm font-medium">{count}</Text>
                            </View>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content directionalHint="bottomLeft" minWidth={140} maxWidth={140}>
                            {COUNT_OPTIONS.map((option) => (
                                <DropdownMenu.Item key={option} onSelect={() => setCount(option)}>
                                    <Text className="text-white text-sm">{option}</Text>
                                </DropdownMenu.Item>
                            ))}
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                    {errorMessage ? (
                        <View className="rounded-md border border-border-primary/60 bg-red-500/10 px-3 py-2">
                            <Text className="text-sm text-red-200">{errorMessage}</Text>
                        </View>
                    ) : null}
                    <View className="flex-row justify-end gap-2">
                        <Button variant="secondary" size="small" onClick={close}>
                            <Text className="text-white text-sm">Cancel</Text>
                        </Button>
                        <Button variant="primary" size="small" onClick={() => void handleCreate()} disabled={!canCreate}>
                            <Text className="text-white text-sm font-medium">Generate</Text>
                        </Button>
                    </View>
                </View>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
});
