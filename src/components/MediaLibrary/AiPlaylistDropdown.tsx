import { useObservable, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { DropdownMenu } from "@/components/DropdownMenu";
import { Select } from "@/components/Select";
import { TextInputMac, type TextInputMacRef } from "@/components/TextInputMac";
import { showToast } from "@/components/Toast";
import { finishAiPlaylistFill, startAiPlaylistFill } from "@/systems/ai";
import { buildPlaylistEntries } from "@/systems/ai/playlistTracks";
import { AI_PROMPT_SOURCE_OPTIONS, type AiPromptSource, getAiPromptPlaceholder } from "@/systems/ai/promptSource";
import { generatePlaylistSummary } from "@/systems/ai/summary";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import { libraryUI$ } from "@/systems/LibraryState";
import { localMusicState$ } from "@/systems/LocalMusicState";
import { addTracksToPlaylist, updatePlaylistMetadata } from "@/systems/LocalPlaylists";
import { settings$ } from "@/systems/Settings";
import {
    fetchSuggestions,
    isSelectedSuggestionProviderAvailable$,
    selectedSuggestionProvider$,
} from "@/systems/suggestions";
import type { SFSymbols } from "@/types/SFSymbols";

const DEFAULT_SUGGESTION_COUNT = 10;

type AiPlaylistDropdownProps = {
    disabled?: boolean;
    buttonVariant?: "icon-hover" | "icon" | "secondary" | "primary";
    buttonSize?: "small" | "medium" | "xs";
    buttonClassName?: string;
    buttonLabel?: string;
    buttonIcon?: SFSymbols;
};

export function AiPlaylistDropdown({
    disabled = false,
    buttonVariant = "icon-hover",
    buttonSize = "small",
    buttonClassName,
    buttonLabel,
    buttonIcon,
}: AiPlaylistDropdownProps) {
    const isOpen$ = useObservable(false);
    const isOpen = useValue(isOpen$);
    const [prompt, setPrompt] = useState("");
    const defaultPromptSource = useValue(settings$.ai.promptSource);
    const [promptSource, setPromptSource] = useState<AiPromptSource>(defaultPromptSource);
    const [isCreating, setIsCreating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const textInputRef = useRef<TextInputMacRef>(null);
    const reopenAfterErrorRef = useRef(false);
    const selectedView = useValue(libraryUI$.selectedView);
    const selectedPlaylistId = useValue(libraryUI$.selectedPlaylistId);
    const selectedPlaylistProvider = useValue(libraryUI$.selectedPlaylistProvider);
    const localPlaylists = useValue(localMusicState$.playlists);
    const selectedProvider = useValue(selectedSuggestionProvider$);
    const providerName = selectedProvider?.name ?? "AI";
    const providerAvailable = useValue(isSelectedSuggestionProviderAvailable$);
    const aiSettings = useValue(settings$.ai);
    const isFeatureEnabled = aiSettings.enabled;
    const targetPlaylist =
        selectedView === "playlist" && selectedPlaylistProvider === "local"
            ? (localPlaylists.find((playlist) => playlist.id === selectedPlaylistId) ?? null)
            : null;
    const isTargetEditable = Boolean(targetPlaylist && targetPlaylist.source === "cache" && targetPlaylist.filePath);
    const isDisabled = disabled || !providerAvailable || !isFeatureEnabled || !isTargetEditable;
    const dialogTitle = targetPlaylist ? `Add tracks to ${targetPlaylist.name}` : `Add tracks with ${providerName}`;
    const triggerIcon = buttonIcon ?? "sparkles";
    const triggerLabel = buttonLabel?.trim();

    const close = useCallback(() => {
        isOpen$.set(false);
    }, [isOpen$]);

    const canCreate = prompt.trim().length > 0 && !isCreating && !isDisabled && Boolean(targetPlaylist);

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
            if (!targetPlaylist) {
                reopenWithError("Select a local playlist to fill.");
                return;
            }

            startAiPlaylistFill(targetPlaylist.id);
            close();

            const summaryPromise = generatePlaylistSummary(trimmedPrompt).catch((error) => {
                console.warn("AI playlist summary failed", error);
                return null;
            });

            const { tracks, unresolved } = await fetchSuggestions({
                mode: "playlist",
                prompt: trimmedPrompt,
                count: DEFAULT_SUGGESTION_COUNT,
                promptSource,
                cachePrompt: trimmedPrompt,
                excludeTrackIds: targetPlaylist.trackPaths,
            });

            if (tracks.length === 0) {
                reopenWithError("No tracks were suggested.");
                return;
            }

            const { trackEntries, trackPaths } = buildPlaylistEntries(tracks);

            if (trackPaths.length === 0) {
                reopenWithError("No resolved tracks to add.");
                return;
            }

            const { addedPaths, playlist: updatedPlaylist } = await addTracksToPlaylist(targetPlaylist.id, trackPaths, {
                trackEntries,
            });

            const summary = await summaryPromise;
            try {
                updatePlaylistMetadata(targetPlaylist.id, {
                    aiPrompt: trimmedPrompt,
                    aiSummary: summary ?? undefined,
                    aiSource: promptSource,
                });
            } catch (error) {
                console.warn("Failed to save AI playlist metadata", error);
            }

            const addedLabel = addedPaths.length === 1 ? "track" : "tracks";
            showToast(`Added ${addedPaths.length} ${addedLabel} to ${updatedPlaylist.name}`, "info");

            if (unresolved && unresolved.length > 0) {
                showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
            }
        } catch (error) {
            console.error("AI playlist creation failed", error);
            const message = error instanceof Error ? error.message : "Failed to create AI playlist";
            reopenWithError(message);
        } finally {
            finishAiPlaylistFill();
            setIsCreating(false);
        }
    }, [canCreate, close, prompt, promptSource, reopenWithError, targetPlaylist]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (reopenAfterErrorRef.current) {
            reopenAfterErrorRef.current = false;
        } else {
            setPrompt("");
            setErrorMessage(null);
            setPromptSource(targetPlaylist?.aiSource ?? defaultPromptSource);
        }
        setTimeout(() => {
            textInputRef.current?.focus();
        }, 0);
    }, [defaultPromptSource, isOpen, targetPlaylist?.aiSource]);

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
        <DropdownMenu.Root isOpen$={isOpen$}>
            <DropdownMenu.Trigger asChild disabled={isDisabled}>
                <Button
                    icon={triggerIcon}
                    variant={buttonVariant}
                    size={buttonSize}
                    accessibilityLabel={dialogTitle}
                    disabled={isDisabled}
                    className={buttonClassName}
                >
                    {triggerLabel ? <Text className="text-white text-sm font-medium">{triggerLabel}</Text> : null}
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
                directionalHint="topCenter"
                minWidth={360}
                maxWidth={360}
                setInitialFocus
                scrolls={false}
            >
                <View className="p-3 bg-background-tertiary border border-border-primary rounded-md gap-2">
                    <Text className="text-text-secondary text-xs font-medium">{dialogTitle}</Text>
                    <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-text-secondary text-xs font-medium">Source</Text>
                        <Select
                            value={promptSource}
                            options={AI_PROMPT_SOURCE_OPTIONS}
                            onValueChange={(value) => setPromptSource(value as AiPromptSource)}
                            triggerClassName="w-44"
                            minWidth="auto"
                        />
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
                            placeholder={getAiPromptPlaceholder(promptSource, "playlist")}
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
                        <Button
                            variant="primary"
                            size="small"
                            onClick={() => void handleCreate()}
                            disabled={!canCreate}
                        >
                            <Text className="text-white text-sm font-medium">Add Tracks</Text>
                        </Button>
                    </View>
                </View>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}
