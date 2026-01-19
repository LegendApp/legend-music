import { useObservable, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { DropdownMenu } from "@/components/DropdownMenu";
import { showToast } from "@/components/Toast";
import { fetchAiSuggestions } from "@/systems/ai";
import { addTracksToPlaylist } from "@/systems/LocalPlaylists";
import { createLocalPlaylist } from "@/systems/LocalMusicState";
import { selectLibraryPlaylist } from "@/systems/LibraryState";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";

const DEFAULT_AI_PLAYLIST_COUNT = 10;

type AiPlaylistDropdownProps = {
    disabled?: boolean;
    buttonVariant?: "icon-hover" | "icon";
    buttonSize?: "small" | "medium" | "xs";
    buttonClassName?: string;
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
}: AiPlaylistDropdownProps) {
    const isOpen$ = useObservable(false);
    const isOpen = useValue(isOpen$);
    const [prompt, setPrompt] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const textInputRef = useRef<TextInput>(null);

    const close = useCallback(() => {
        isOpen$.set(false);
    }, [isOpen$]);

    const canCreate = prompt.trim().length > 0 && !isCreating && !disabled;

    const handleCreate = useCallback(async () => {
        if (!canCreate) {
            return;
        }

        const trimmedPrompt = prompt.trim();
        setIsCreating(true);
        try {
            const { tracks, unresolved } = await fetchAiSuggestions({
                mode: "playlist",
                prompt: trimmedPrompt,
                count: DEFAULT_AI_PLAYLIST_COUNT,
            });

            if (tracks.length === 0) {
                showToast("AI did not return any tracks", "error");
                return;
            }

            const playlistName = buildPlaylistName(trimmedPrompt);
            const playlist = createLocalPlaylist(playlistName);

            const trackPaths = Array.from(
                new Set(tracks.map(resolveTrackPath).filter((path): path is string => Boolean(path))),
            );

            if (trackPaths.length === 0) {
                showToast("No resolved tracks to add", "error");
                return;
            }

            const { addedPaths, playlist: updatedPlaylist } = await addTracksToPlaylist(playlist.id, trackPaths);
            selectLibraryPlaylist(updatedPlaylist.id, "local");

            const addedLabel = addedPaths.length === 1 ? "track" : "tracks";
            showToast(`Created ${updatedPlaylist.name} with ${addedPaths.length} ${addedLabel}`, "info");

            if (unresolved.length > 0) {
                showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
            }

            close();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create AI playlist";
            showToast(message, "error");
        } finally {
            setIsCreating(false);
        }
    }, [canCreate, close, prompt]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setPrompt("");
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
            <DropdownMenu.Trigger asChild disabled={disabled}>
                <Button
                    icon="sparkles"
                    variant={buttonVariant}
                    size={buttonSize}
                    accessibilityLabel="Create playlist with AI"
                    disabled={disabled}
                    className={buttonClassName}
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
                    <Text className="text-text-secondary text-xs font-medium">Create playlist with AI</Text>
                    <View className="bg-background-secondary border border-border-primary rounded-md px-3 py-2">
                        <TextInput
                            ref={textInputRef}
                            value={prompt}
                            onChangeText={setPrompt}
                            placeholder="Describe the playlist vibe"
                            placeholderTextColor="#6b7280"
                            multiline
                            className="text-sm text-text-primary min-h-16"
                        />
                    </View>
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
