import { useObservable, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { DropdownMenu } from "@/components/DropdownMenu";
import { showToast } from "@/components/Toast";
import { fetchSuggestions, isSelectedSuggestionProviderAvailable$, selectedSuggestionProvider$ } from "@/systems/suggestions";
import { addTracksToPlaylist } from "@/systems/LocalPlaylists";
import { createLocalPlaylist } from "@/systems/LocalMusicState";
import { selectLibraryPlaylist } from "@/systems/LibraryState";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import { settings$ } from "@/systems/Settings";
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

const buildPlaylistName = (prompt: string): string => {
    const trimmed = prompt.trim();
    if (!trimmed) {
        return "AI Playlist";
    }

    const shortened = trimmed.length > 50 ? `${trimmed.slice(0, 47).trim()}...` : trimmed;
    return `AI - ${shortened}`;
};

const resolveTrackPath = (track: { filePath?: string; uri?: string; id?: string }): string | null => {
    return track.filePath || track.uri || track.id || null;
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
    const [isCreating, setIsCreating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const textInputRef = useRef<TextInput>(null);
    const selectedProvider = useValue(selectedSuggestionProvider$);
    const providerName = selectedProvider?.name ?? "AI";
    const providerAvailable = useValue(isSelectedSuggestionProviderAvailable$);
    const aiSettings = useValue(settings$.ai);
    const isFeatureEnabled = aiSettings.enabled && aiSettings.playlistCreation;
    const isDisabled = disabled || !providerAvailable || !isFeatureEnabled;
    const dialogTitle = `Create playlist with ${providerName}`;
    const triggerIcon = buttonIcon ?? "sparkles";
    const triggerLabel = buttonLabel?.trim();

    const close = useCallback(() => {
        isOpen$.set(false);
    }, [isOpen$]);

    const canCreate = prompt.trim().length > 0 && !isCreating && !isDisabled;

    const handleCreate = useCallback(async () => {
        if (!canCreate) {
            return;
        }

        const trimmedPrompt = prompt.trim();
        setErrorMessage(null);
        setIsCreating(true);
        try {
            const { tracks, unresolved } = await fetchSuggestions({
                mode: "playlist",
                prompt: trimmedPrompt,
                count: DEFAULT_SUGGESTION_COUNT,
            });

            if (tracks.length === 0) {
                setErrorMessage("No tracks were suggested.");
                return;
            }

            const playlistName = buildPlaylistName(trimmedPrompt);
            const playlist = createLocalPlaylist(playlistName);

            const trackPaths = Array.from(
                new Set(tracks.map(resolveTrackPath).filter((path): path is string => Boolean(path))),
            );

            if (trackPaths.length === 0) {
                setErrorMessage("No resolved tracks to add.");
                return;
            }

            const { addedPaths, playlist: updatedPlaylist } = await addTracksToPlaylist(playlist.id, trackPaths);
            selectLibraryPlaylist(updatedPlaylist.id, "local");

            const addedLabel = addedPaths.length === 1 ? "track" : "tracks";
            showToast(`Created ${updatedPlaylist.name} with ${addedPaths.length} ${addedLabel}`, "info");

            if (unresolved && unresolved.length > 0) {
                showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
            }

            close();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create AI playlist";
            setErrorMessage(message);
        } finally {
            setIsCreating(false);
        }
    }, [canCreate, close, prompt]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setPrompt("");
        setErrorMessage(null);
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
                            placeholder="Describe the playlist vibe"
                            placeholderTextColor="#6b7280"
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
                        <Button
                            variant="primary"
                            size="small"
                            onClick={() => void handleCreate()}
                            disabled={!canCreate}
                        >
                            <Text className="text-white text-sm font-medium">Create</Text>
                        </Button>
                    </View>
                </View>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
}
