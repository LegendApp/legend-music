import { LegendList } from "@legendapp/list";
import { observable, type Observable } from "@legendapp/state";
import { useObservable, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";

import { Button } from "@/components/Button";
import { DropdownMenu } from "@/components/DropdownMenu";
import { SkiaSpinner } from "@/components/SkiaSpinner";
import { showToast } from "@/components/Toast";
import {
    type DragData,
    DraggableItem,
    type DraggedItem,
    DroppableZone,
    LOCAL_PLAYLIST_DRAG_ZONE_ID,
    type LocalPlaylistDragData,
    MEDIA_LIBRARY_DRAG_ZONE_ID,
    type MediaLibraryDragData,
} from "@/components/dnd";
import { audioPlayerState$ } from "@/components/AudioPlayer";
import { Table, TableCell, type TableColumnSpec, TableHeader, TableRow } from "@/components/Table";
import type { TrackData } from "@/components/TrackItem";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { type ContextMenuItem, showContextMenu } from "@/native-modules/ContextMenu";
import { type NativeDragTrack, TrackDragSource } from "@/native-modules/TrackDragSource";
import { getProviderPlugin } from "@/providers/pluginRegistry";
import type { ProviderPlaylist } from "@/providers/types";
import { Icon } from "@/systems/Icon";
import { libraryUI$ } from "@/systems/LibraryState";
import { addTracksToPlaylist, updatePlaylistMetadata } from "@/systems/LocalPlaylists";
import { type LocalPlaylist, localMusicState$, saveLocalPlaylistTracks } from "@/systems/LocalMusicState";
import { aiPlaylistFillState$, finishAiPlaylistFill, startAiPlaylistFill } from "@/systems/ai";
import { buildPlaylistEntries } from "@/systems/ai/playlistTracks";
import { generatePlaylistSummary } from "@/systems/ai/summary";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import { fetchSuggestions } from "@/systems/suggestions";
import { themeState$ } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import type { QueueAction } from "@/utils/queueActions";
import { useLibraryTrackList } from "./useLibraryTrackList";
import { AiPlaylistDropdown } from "./AiPlaylistDropdown";

type TrackListProps = {};

const emptyProviderPlaylists$ = observable([] as ProviderPlaylist[]);
const DEFAULT_AI_SUGGESTION_COUNT = 10;

const formatAddedDate = (timestamp?: number): string => {
    if (!timestamp) {
        return "";
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const buildPlaylistExtendPrompt = (prompt: string, playlist: LocalPlaylist | null): string => {
    if (!playlist) {
        return prompt;
    }

    const lines: string[] = [];
    const seen = new Set<string>();
    const addLine = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) {
            return;
        }
        const key = trimmed.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        lines.push(trimmed);
    };

    const trackEntries = playlist.tracks ?? [];
    if (trackEntries.length > 0) {
        for (const track of trackEntries) {
            const title = track.title?.trim() || track.filePath.split("/").pop() || track.filePath;
            const artist = track.artist?.trim();
            addLine(artist ? `${artist} - ${title}` : title);
        }
    } else if (playlist.trackPaths.length > 0) {
        for (const path of playlist.trackPaths) {
            const title = path.split("/").pop() || path;
            addLine(title);
        }
    }

    if (lines.length === 0) {
        return prompt;
    }

    const avoidLine = "Avoid suggesting any of these tracks already in the playlist:";
    const instructionLine = "Only suggest new, non-duplicate tracks.";
    return `${prompt}\n\n${avoidLine}\n${lines.join("\n")}\n\n${instructionLine}`;
};

export function TrackList(_props: TrackListProps) {
    const {
        tracks,
        selectedIndices$,
        handleTrackClick,
        handleTrackDoubleClick,
        handleTrackContextMenu,
        handleTrackQueueAction,
        syncSelectionAfterReorder,
        handleNativeDragStart,
        buildDragData,
        keyExtractor,
    } = useLibraryTrackList();

    const selectedView = useValue(libraryUI$.selectedView);
    const selectedPlaylistId = useValue(libraryUI$.selectedPlaylistId);
    const selectedPlaylistProvider = useValue(libraryUI$.selectedPlaylistProvider);
    const searchQuery = useValue(libraryUI$.searchQuery);
    const playlistSort = useValue(libraryUI$.playlistSort);
    const playlistSortDirection = useValue(libraryUI$.playlistSortDirection);
    const playlists = useValue(localMusicState$.playlists);
    const aiPlaylistFillState = useValue(aiPlaylistFillState$);
    const providerPlugin = selectedPlaylistProvider ? getProviderPlugin(selectedPlaylistProvider) : null;
    const providerPlaylists = useValue(providerPlugin?.library?.playlists$ ?? emptyProviderPlaylists$);
    const showAiCreateButton = selectedView === "playlist" && selectedPlaylistProvider === "local";
    const showAiFillSpinner =
        selectedView === "playlist" &&
        selectedPlaylistProvider === "local" &&
        aiPlaylistFillState.isGenerating &&
        aiPlaylistFillState.playlistId === selectedPlaylistId;

    const nonSeparatorTrackCount = useMemo(
        () => tracks.reduce((count, track) => (track.isSeparator ? count : count + 1), 0),
        [tracks],
    );

    const selectedLocalPlaylist = useMemo(() => {
        if (selectedView !== "playlist" || selectedPlaylistProvider !== "local" || !selectedPlaylistId) {
            return null;
        }

        return playlists.find((pl) => pl.id === selectedPlaylistId) ?? null;
    }, [playlists, selectedPlaylistId, selectedPlaylistProvider, selectedView]);

    const aiPromptEditorOpen$ = useObservable(false);
    const aiPromptEditorOpen = useValue(aiPromptEditorOpen$);
    const aiPromptInputRef = useRef<TextInput>(null);
    const [aiPromptDraft, setAiPromptDraft] = useState("");
    const [aiPromptError, setAiPromptError] = useState<string | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const extendPromptOpen$ = useObservable(false);
    const extendPromptOpen = useValue(extendPromptOpen$);
    const extendPromptInputRef = useRef<TextInput>(null);
    const [extendPromptDraft, setExtendPromptDraft] = useState("");
    const [extendPromptError, setExtendPromptError] = useState<string | null>(null);
    const [isExtending, setIsExtending] = useState(false);
    const aiPrompt = selectedLocalPlaylist?.aiPrompt?.trim() ?? "";
    const aiSummary = selectedLocalPlaylist?.aiSummary?.trim() ?? "";
    const showAiSummary = Boolean(aiPrompt && aiSummary);
    const canModifyPlaylist = Boolean(selectedLocalPlaylist && selectedLocalPlaylist.source === "cache");
    const canEditAiPrompt = Boolean(showAiSummary && canModifyPlaylist);

    const selectedProviderPlaylist = useMemo(() => {
        if (
            selectedView !== "playlist" ||
            !selectedPlaylistProvider ||
            selectedPlaylistProvider === "local" ||
            !selectedPlaylistId
        ) {
            return null;
        }

        return providerPlaylists.find((pl) => pl.id === selectedPlaylistId) ?? null;
    }, [providerPlaylists, selectedPlaylistId, selectedPlaylistProvider, selectedView]);

    const headerConfig = useMemo(() => {
        if (selectedView === "playlist") {
            if (selectedPlaylistProvider === "local" && selectedLocalPlaylist) {
                return { title: selectedLocalPlaylist.name, count: selectedLocalPlaylist.trackCount };
            }

            if (selectedPlaylistProvider && selectedPlaylistProvider !== "local") {
                return {
                    title: selectedProviderPlaylist?.name ?? "Playlist",
                    count: selectedProviderPlaylist?.trackCount ?? nonSeparatorTrackCount,
                };
            }
        }

        if (selectedView === "artists") {
            return { title: "Artists", count: nonSeparatorTrackCount };
        }

        if (selectedView === "albums") {
            return { title: "Albums", count: nonSeparatorTrackCount };
        }

        if (selectedView === "songs") {
            return { title: "Songs", count: nonSeparatorTrackCount };
        }

        return null;
    }, [
        nonSeparatorTrackCount,
        selectedLocalPlaylist,
        selectedPlaylistProvider,
        selectedProviderPlaylist,
        selectedView,
    ]);

    const closeAiPromptEditor = useCallback(() => {
        aiPromptEditorOpen$.set(false);
    }, [aiPromptEditorOpen$]);

    const closeExtendPrompt = useCallback(() => {
        extendPromptOpen$.set(false);
    }, [extendPromptOpen$]);

    const isAiBusy = isRegenerating || isExtending;
    const canRegenerate =
        aiPromptDraft.trim().length > 0 && !isAiBusy && Boolean(selectedLocalPlaylist && canEditAiPrompt);
    const canExtendWithExistingPrompt = Boolean(aiPrompt && canModifyPlaylist && !isAiBusy);
    const canExtendWithNewPrompt = Boolean(canModifyPlaylist && !isAiBusy);

    const handleRegenerate = useCallback(async () => {
        if (!selectedLocalPlaylist || !canEditAiPrompt) {
            return;
        }

        const trimmedPrompt = aiPromptDraft.trim();
        if (!trimmedPrompt || isRegenerating) {
            return;
        }

        setAiPromptError(null);
        setIsRegenerating(true);

        const summaryPromise = generatePlaylistSummary(trimmedPrompt).catch((error) => {
            console.warn("AI playlist summary failed", error);
            return null;
        });

        try {
            startAiPlaylistFill(selectedLocalPlaylist.id);

            const count =
                selectedLocalPlaylist.trackCount > 0 ? selectedLocalPlaylist.trackCount : DEFAULT_AI_SUGGESTION_COUNT;
            const { tracks, unresolved } = await fetchSuggestions({
                mode: "playlist",
                prompt: trimmedPrompt,
                count,
            });

            if (tracks.length === 0) {
                setAiPromptError("No tracks were suggested.");
                return;
            }

            const { trackEntries, trackPaths } = buildPlaylistEntries(tracks);
            if (trackPaths.length === 0) {
                setAiPromptError("No resolved tracks to add.");
                return;
            }

            const summary = await summaryPromise;
            saveLocalPlaylistTracks(
                {
                    ...selectedLocalPlaylist,
                    aiPrompt: trimmedPrompt,
                    aiSummary: summary ?? selectedLocalPlaylist.aiSummary,
                },
                trackPaths,
                trackEntries,
            );

            const addedLabel = trackPaths.length === 1 ? "track" : "tracks";
            showToast(`Regenerated ${trackPaths.length} ${addedLabel}`, "info");
            if (unresolved && unresolved.length > 0) {
                showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
            }

            closeAiPromptEditor();
        } catch (error) {
            console.error("AI playlist regeneration failed", error);
            const message = error instanceof Error ? error.message : "Failed to regenerate AI playlist";
            setAiPromptError(message);
        } finally {
            finishAiPlaylistFill();
            setIsRegenerating(false);
        }
    }, [
        aiPromptDraft,
        canEditAiPrompt,
        closeAiPromptEditor,
        isRegenerating,
        selectedLocalPlaylist,
    ]);

    const extendPlaylist = useCallback(
        async (
            promptValue: string,
            options: {
                updateMetadata?: boolean;
                onError?: (message: string) => void;
                onSuccess?: () => void;
            } = {},
        ) => {
            if (!selectedLocalPlaylist || !canModifyPlaylist) {
                return;
            }

            const trimmedPrompt = promptValue.trim();
            if (!trimmedPrompt) {
                options.onError?.("Prompt cannot be empty.");
                return;
            }

            if (isAiBusy) {
                return;
            }

            const promptWithContext = buildPlaylistExtendPrompt(trimmedPrompt, selectedLocalPlaylist);
            const summaryPromise = options.updateMetadata
                ? generatePlaylistSummary(trimmedPrompt).catch((error) => {
                      console.warn("AI playlist summary failed", error);
                      return null;
                  })
                : Promise.resolve(null);

            setIsExtending(true);
            try {
                startAiPlaylistFill(selectedLocalPlaylist.id);

                const { tracks: suggestedTracks, unresolved } = await fetchSuggestions({
                    mode: "playlist",
                    prompt: promptWithContext,
                    count: DEFAULT_AI_SUGGESTION_COUNT,
                });

                if (suggestedTracks.length === 0) {
                    options.onError?.("No tracks were suggested.");
                    return;
                }

                const { trackEntries, trackPaths } = buildPlaylistEntries(suggestedTracks);
                if (trackPaths.length === 0) {
                    options.onError?.("No resolved tracks to add.");
                    return;
                }

                const { addedPaths, playlist } = await addTracksToPlaylist(selectedLocalPlaylist.id, trackPaths, {
                    trackEntries,
                });

                if (options.updateMetadata) {
                    const summary = await summaryPromise;
                    try {
                        updatePlaylistMetadata(selectedLocalPlaylist.id, {
                            aiPrompt: trimmedPrompt,
                            aiSummary: summary ?? selectedLocalPlaylist.aiSummary,
                        });
                    } catch (error) {
                        console.warn("Failed to update AI playlist metadata", error);
                    }
                }

                const addedLabel = addedPaths.length === 1 ? "track" : "tracks";
                showToast(`Added ${addedPaths.length} ${addedLabel} to ${playlist.name}`, "info");
                if (unresolved && unresolved.length > 0) {
                    showToast(`Skipped ${unresolved.length} tracks that could not be matched`, "info");
                }

                options.onSuccess?.();
            } catch (error) {
                console.error("AI playlist extension failed", error);
                const message = error instanceof Error ? error.message : "Failed to extend AI playlist";
                options.onError?.(message);
            } finally {
                finishAiPlaylistFill();
                setIsExtending(false);
            }
        },
        [canModifyPlaylist, isAiBusy, selectedLocalPlaylist],
    );

    const handleExtendExistingPrompt = useCallback(() => {
        if (!aiPrompt) {
            showToast("No AI prompt found for this playlist.", "info");
            return;
        }

        void extendPlaylist(aiPrompt);
    }, [aiPrompt, extendPlaylist]);

    const handleExtendWithNewPrompt = useCallback(() => {
        void extendPlaylist(extendPromptDraft, {
            updateMetadata: true,
            onError: (message) => setExtendPromptError(message),
            onSuccess: closeExtendPrompt,
        });
    }, [closeExtendPrompt, extendPlaylist, extendPromptDraft]);

    useEffect(() => {
        if (!aiPromptEditorOpen) {
            return;
        }

        setAiPromptDraft(aiPrompt);
        setAiPromptError(null);
        setTimeout(() => {
            aiPromptInputRef.current?.focus();
        }, 0);
    }, [aiPrompt, aiPromptEditorOpen]);

    useEffect(() => {
        if (!aiPromptEditorOpen) {
            return;
        }

        return KeyboardManager.addKeyDownListener((event) => {
            if (event.keyCode === KeyCodes.KEY_ESCAPE) {
                closeAiPromptEditor();
                return true;
            }

            if (event.keyCode === KeyCodes.KEY_RETURN) {
                if (canRegenerate) {
                    void handleRegenerate();
                    return true;
                }
            }

            return false;
        });
    }, [aiPromptEditorOpen, canRegenerate, closeAiPromptEditor, handleRegenerate]);

    useEffect(() => {
        if (!extendPromptOpen) {
            return;
        }

        setExtendPromptDraft("");
        setExtendPromptError(null);
        setTimeout(() => {
            extendPromptInputRef.current?.focus();
        }, 0);
    }, [extendPromptOpen]);

    useEffect(() => {
        if (!extendPromptOpen) {
            return;
        }

        return KeyboardManager.addKeyDownListener((event) => {
            if (event.keyCode === KeyCodes.KEY_ESCAPE) {
                closeExtendPrompt();
                return true;
            }

            if (event.keyCode === KeyCodes.KEY_RETURN) {
                if (!isAiBusy && extendPromptDraft.trim().length > 0) {
                    void extendPlaylist(extendPromptDraft, {
                        updateMetadata: true,
                        onError: (message) => setExtendPromptError(message),
                        onSuccess: closeExtendPrompt,
                    });
                    return true;
                }
            }

            return false;
        });
    }, [closeExtendPrompt, extendPlaylist, extendPromptDraft, extendPromptOpen, isAiBusy]);

    const isPlaylistEditable =
        selectedView === "playlist" &&
        selectedPlaylistProvider === "local" &&
        selectedLocalPlaylist !== null &&
        selectedLocalPlaylist.source === "cache" &&
        playlistSort === "playlist-order" &&
        playlistSortDirection === "asc" &&
        searchQuery.trim().length === 0;

    const showExtendFooter =
        selectedView === "playlist" &&
        selectedPlaylistProvider === "local" &&
        Boolean(selectedLocalPlaylist) &&
        canModifyPlaylist;

    const showDateAddedColumn = selectedView === "playlist";

    const columns = useMemo<TableColumnSpec[]>(() => {
        const nextColumns: TableColumnSpec[] = [
            { id: "number", label: "#", width: 36, align: "right", sortId: "playlist-order" },
            { id: "title", label: "Title", flex: 3, minWidth: 120, sortId: "title" },
            { id: "artist", label: "Artist", flex: 2, minWidth: 100, sortId: "artist" },
            { id: "album", label: "Album", flex: 2, minWidth: 100, sortId: "album" },
        ];

        if (showDateAddedColumn) {
            nextColumns.push({ id: "date-added", label: "Date added", width: 120, sortId: "date-added" });
        }

        nextColumns.push(
            { id: "duration", label: "Duration", width: 64, align: "right" },
            { id: "actions", width: 28, align: "center" },
            { id: "source", width: 28, align: "center" },
        );

        return nextColumns;
    }, [showDateAddedColumn]);
    const handleColumnSort = useCallback(
        (sortId: string) => {
            if (
                sortId !== "playlist-order" &&
                sortId !== "date-added" &&
                sortId !== "title" &&
                sortId !== "artist" &&
                sortId !== "album"
            ) {
                return;
            }

            if (sortId === playlistSort) {
                const nextDirection = playlistSortDirection === "asc" ? "desc" : "asc";
                libraryUI$.playlistSortDirection.set(nextDirection);
                return;
            }

            const defaultDirection = sortId === "date-added" ? "desc" : "asc";
            libraryUI$.playlistSort.set(sortId);
            libraryUI$.playlistSortDirection.set(defaultDirection);
        },
        [playlistSort, playlistSortDirection],
    );

    const allowPlaylistDrop = useCallback(
        (item: DraggedItem<DragData>) => {
            if (!isPlaylistEditable || !selectedLocalPlaylist) {
                return false;
            }

            const data = item.data;
            if (!data) {
                return false;
            }

            if (data.type === "local-playlist-track" && item.sourceZoneId === LOCAL_PLAYLIST_DRAG_ZONE_ID) {
                return data.playlistId === selectedLocalPlaylist.id;
            }

            if (data.type === "media-library-tracks" && item.sourceZoneId === MEDIA_LIBRARY_DRAG_ZONE_ID) {
                return data.tracks.length > 0;
            }

            return false;
        },
        [isPlaylistEditable, selectedLocalPlaylist],
    );

    const handleDropAtPosition = useCallback(
        async (item: DraggedItem<DragData>, targetPosition: number) => {
            if (!isPlaylistEditable || !selectedLocalPlaylist) {
                return;
            }

            const data = item.data;
            const currentPaths = selectedLocalPlaylist.trackPaths;
            const boundedTarget = Math.max(0, Math.min(targetPosition, currentPaths.length));

            if (data.type === "local-playlist-track") {
                if (data.playlistId !== selectedLocalPlaylist.id) {
                    return;
                }

                const sourceIndex = Math.max(0, Math.min(data.sourceIndex, currentPaths.length - 1));
                if (
                    sourceIndex === boundedTarget ||
                    (sourceIndex < boundedTarget && sourceIndex + 1 === boundedTarget)
                ) {
                    return;
                }

                const nextPaths = currentPaths.slice();
                const [movedPath] = nextPaths.splice(sourceIndex, 1);
                const insertIndex = boundedTarget > sourceIndex ? boundedTarget - 1 : boundedTarget;
                nextPaths.splice(insertIndex, 0, movedPath);

                await saveLocalPlaylistTracks(selectedLocalPlaylist, nextPaths);
                syncSelectionAfterReorder(sourceIndex, boundedTarget);
                return;
            }

            if (data.type === "media-library-tracks") {
                const insertPaths = data.tracks.map((track) => track.filePath);
                const nextPaths = currentPaths.slice();
                nextPaths.splice(boundedTarget, 0, ...insertPaths);
                await saveLocalPlaylistTracks(selectedLocalPlaylist, nextPaths);
            }
        },
        [isPlaylistEditable, selectedLocalPlaylist, syncSelectionAfterReorder],
    );

    const renderTrack = useCallback(
        ({ item, index }: { item: TrackData; index: number }) => {
            if (item.isSeparator) {
                return <LibrarySeparatorRow title={item.title} />;
            }

            const trackPathForPlaylist =
                isPlaylistEditable && selectedLocalPlaylist
                    ? (selectedLocalPlaylist.trackPaths[index] ?? item.id)
                    : null;

            const trackRow = (
                <LibraryTrackRow
                    track={item}
                    index={index}
                    columns={columns}
                    onClick={handleTrackClick}
                    onDoubleClick={handleTrackDoubleClick}
                    onRightClick={handleTrackContextMenu}
                    onMenuAction={handleTrackQueueAction}
                    selectedIndices$={selectedIndices$}
                    buildDragData={buildDragData}
                    onNativeDragStart={handleNativeDragStart}
                    isPlaylistEditable={isPlaylistEditable}
                    playlistId={selectedLocalPlaylist?.id ?? null}
                    trackPath={trackPathForPlaylist}
                />
            );

            if (isPlaylistEditable && Platform.OS !== "macos") {
                return (
                    <View>
                        {trackRow}
                        <LocalPlaylistDropZone
                            position={index + 1}
                            allowDrop={allowPlaylistDrop}
                            onDrop={handleDropAtPosition}
                        />
                    </View>
                );
            }

            return trackRow;
        },
        [
            allowPlaylistDrop,
            buildDragData,
            handleTrackClick,
            handleTrackDoubleClick,
            handleTrackContextMenu,
            handleTrackQueueAction,
            handleNativeDragStart,
            handleDropAtPosition,
            isPlaylistEditable,
            selectedLocalPlaylist,
            selectedIndices$,
            columns,
        ],
    );

    const getItemType = useCallback((item: TrackData) => {
        return item.isSeparator ? "separator" : "track";
    }, []);

    const getFixedItemSize = useCallback((_: number, item: TrackData, type: string | undefined) => {
        return item.isSeparator ? 72 : 32;
    }, []);

    return (
        <View className="flex-1 pl-2">
            {headerConfig ? (
                <View className="px-3 py-2 flex-row items-center gap-2">
                    <View className="flex-1 min-w-0">
                        <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                            {headerConfig.title}
                        </Text>
                        <Text className="text-xs text-text-secondary" numberOfLines={1}>
                            {headerConfig.count} {headerConfig.count === 1 ? "track" : "tracks"}
                        </Text>
                        {showAiSummary ? (
                            <View className="mt-1 flex-row items-center gap-1">
                                <Text className="text-xs text-text-secondary flex-1 min-w-0" numberOfLines={1}>
                                    AI: {aiSummary}
                                </Text>
                                {canEditAiPrompt ? (
                                    <DropdownMenu.Root isOpen$={aiPromptEditorOpen$}>
                                        <DropdownMenu.Trigger asChild>
                                            <Button
                                                icon="square.and.pencil"
                                                variant="icon-hover"
                                                size="xs"
                                                iconSize={12}
                                                tooltip="Edit AI prompt"
                                            />
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content
                                            directionalHint="bottomLeft"
                                            minWidth={360}
                                            maxWidth={360}
                                            setInitialFocus
                                            scrolls={false}
                                        >
                                            <View className="p-3 bg-background-tertiary border border-border-primary rounded-md gap-2">
                                                <Text className="text-text-secondary text-xs font-medium">
                                                    Edit AI prompt
                                                </Text>
                                                <View className="bg-background-secondary border border-border-primary rounded-md px-3 py-2">
                                                    <TextInput
                                                        ref={aiPromptInputRef}
                                                        value={aiPromptDraft}
                                                        onChangeText={(value) => {
                                                            setAiPromptDraft(value);
                                                            if (aiPromptError) {
                                                                setAiPromptError(null);
                                                            }
                                                        }}
                                                        placeholder="Describe the playlist"
                                                        placeholderTextColor="#6b7280"
                                                        multiline
                                                        className="text-sm text-text-primary min-h-16"
                                                    />
                                                </View>
                                                {aiPromptError ? (
                                                    <View className="rounded-md border border-border-primary/60 bg-red-500/10 px-3 py-2">
                                                        <Text className="text-sm text-red-200">{aiPromptError}</Text>
                                                    </View>
                                                ) : null}
                                                <View className="flex-row justify-end gap-2">
                                                    <Button variant="secondary" size="small" onClick={closeAiPromptEditor}>
                                                        <Text className="text-white text-sm">Cancel</Text>
                                                    </Button>
                                                    <Button
                                                        variant="primary"
                                                        size="small"
                                                        onClick={() => void handleRegenerate()}
                                                        disabled={!canRegenerate}
                                                    >
                                                        <Text className="text-white text-sm font-medium">
                                                            {isRegenerating ? "Regenerating..." : "Regenerate"}
                                                        </Text>
                                                    </Button>
                                                </View>
                                            </View>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Root>
                                ) : null}
                            </View>
                        ) : null}
                    </View>
                </View>
            ) : null}
            {showAiFillSpinner ? (
                <View className="flex-row items-center gap-2 px-4 py-2 border-b border-white/10">
                    <SkiaSpinner size={18} color="#7dd6ff" trailColor="rgba(255,255,255,0.08)" />
                    <Text className="text-sm text-text-secondary">Generating AI tracks...</Text>
                </View>
            ) : null}
            <Table
                header={
                    <TableHeader
                        columns={columns}
                        activeSortId={playlistSort}
                        activeSortDirection={playlistSortDirection}
                        onColumnClick={handleColumnSort}
                    />
                }
            >
                <LegendList
                    key={selectedView}
                    data={tracks}
                    keyExtractor={keyExtractor}
                    renderItem={renderTrack}
                    getItemType={getItemType}
                    getFixedItemSize={getFixedItemSize}
                    ListHeaderComponent={
                        isPlaylistEditable && Platform.OS !== "macos" ? (
                            <LocalPlaylistDropZone
                                position={0}
                                allowDrop={allowPlaylistDrop}
                                onDrop={handleDropAtPosition}
                            />
                        ) : undefined
                    }
                    ListFooterComponent={
                        showExtendFooter ? (
                            <View className="px-3 py-3 border-t border-white/10">
                                <View className="flex-row items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        onClick={handleExtendExistingPrompt}
                                        disabled={!canExtendWithExistingPrompt}
                                        tooltip="Extend with existing prompt"
                                    >
                                        <Text className="text-white text-sm">Extend with prompt</Text>
                                    </Button>
                                    <DropdownMenu.Root isOpen$={extendPromptOpen$}>
                                        <DropdownMenu.Trigger asChild disabled={!canExtendWithNewPrompt}>
                                            <Button
                                                variant="secondary"
                                                size="small"
                                                disabled={!canExtendWithNewPrompt}
                                            >
                                                <Text className="text-white text-sm">Extend with new prompt</Text>
                                            </Button>
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content
                                            directionalHint="topLeft"
                                            minWidth={360}
                                            maxWidth={360}
                                            setInitialFocus
                                            scrolls={false}
                                        >
                                            <View className="p-3 bg-background-tertiary border border-border-primary rounded-md gap-2">
                                                <Text className="text-text-secondary text-xs font-medium">
                                                    Extend with new prompt
                                                </Text>
                                                <View className="bg-background-secondary border border-border-primary rounded-md px-3 py-2">
                                                    <TextInput
                                                        ref={extendPromptInputRef}
                                                        value={extendPromptDraft}
                                                        onChangeText={(value) => {
                                                            setExtendPromptDraft(value);
                                                            if (extendPromptError) {
                                                                setExtendPromptError(null);
                                                            }
                                                        }}
                                                        placeholder="Describe the tracks to add"
                                                        placeholderTextColor="#6b7280"
                                                        multiline
                                                        className="text-sm text-text-primary min-h-16"
                                                    />
                                                </View>
                                                {extendPromptError ? (
                                                    <View className="rounded-md border border-border-primary/60 bg-red-500/10 px-3 py-2">
                                                        <Text className="text-sm text-red-200">
                                                            {extendPromptError}
                                                        </Text>
                                                    </View>
                                                ) : null}
                                                <View className="flex-row justify-end gap-2">
                                                    <Button variant="secondary" size="small" onClick={closeExtendPrompt}>
                                                        <Text className="text-white text-sm">Cancel</Text>
                                                    </Button>
                                                    <Button
                                                        variant="primary"
                                                        size="small"
                                                        onClick={handleExtendWithNewPrompt}
                                                        disabled={isAiBusy || extendPromptDraft.trim().length === 0}
                                                    >
                                                        <Text className="text-white text-sm font-medium">
                                                            {isExtending ? "Adding..." : "Add tracks"}
                                                        </Text>
                                                    </Button>
                                                </View>
                                            </View>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Root>
                                </View>
                            </View>
                        ) : undefined
                    }
                    style={{ flex: 1 }}
                    contentContainerStyle={
                        tracks.length
                            ? undefined
                            : {
                                  flexGrow: 1,
                                  justifyContent: "center",
                                  alignItems: "flex-start",
                                  paddingVertical: 16,
                              }
                    }
                    recycleItems
                    ListEmptyComponent={
                        <View className="items-center justify-center py-4 px-2.5 w-full gap-2">
                            <Text className="text-sm text-white/60">No tracks found</Text>
                            {showAiCreateButton ? (
                                <AiPlaylistDropdown
                                    buttonLabel="Create with AI"
                                    buttonVariant="secondary"
                                    buttonSize="small"
                                />
                            ) : null}
                        </View>
                    }
                />
            </Table>
        </View>
    );
}

function LibrarySeparatorRow({ title }: { title: string }) {
    return (
        <View className="flex items-center pt-6 pb-2 border-b border-white/10">
            <Text className="text-white/90 text-xl font-semibold" numberOfLines={1}>
                {title.replace(/^— (.+) —$/, "$1")}
            </Text>
        </View>
    );
}

interface LocalPlaylistDropZoneProps {
    position: number;
    allowDrop: (item: DraggedItem<DragData>) => boolean;
    onDrop: (item: DraggedItem<DragData>, position: number) => void;
}

function LocalPlaylistDropZone({ position, allowDrop, onDrop }: LocalPlaylistDropZoneProps) {
    const dropId = `local-playlist-drop-${position}`;
    const isFirstZone = position === 0;

    return (
        <DroppableZone
            id={dropId}
            allowDrop={(item) => allowDrop(item as DraggedItem<DragData>)}
            onDrop={(item) => onDrop(item as DraggedItem<DragData>, position)}
        >
            {(isActive) => (
                <View
                    pointerEvents="none"
                    className={cn("h-[3px] rounded-full bg-blue-500", isFirstZone ? "-mb-[3px]" : "-mt-[3px]")}
                    style={{ opacity: isActive ? 1 : 0 }}
                />
            )}
        </DroppableZone>
    );
}

interface LibraryTrackRowProps {
    track: TrackData;
    index: number;
    columns: TableColumnSpec[];
    onClick: (index: number, event?: NativeMouseEvent) => void;
    onDoubleClick: (index: number, event?: NativeMouseEvent) => void;
    onRightClick: (index: number, event: NativeMouseEvent) => void;
    onMenuAction: (index: number, action: QueueAction) => void;
    selectedIndices$: Observable<Set<number>>;
    buildDragData: (activeIndex: number) => MediaLibraryDragData;
    onNativeDragStart: () => void;
    isPlaylistEditable: boolean;
    playlistId: string | null;
    trackPath: string | null;
}

const TRACK_ROW_MENU_ITEMS: ContextMenuItem[] = [
    { id: "play-now", title: "Play Now" },
    { id: "play-next", title: "Play Next" },
    { id: "star", title: "Star", enabled: false },
];

function LibraryTrackRow({
    track,
    index,
    columns,
    onClick,
    onDoubleClick,
    onRightClick,
    onMenuAction,
    selectedIndices$,
    buildDragData,
    onNativeDragStart,
    isPlaylistEditable,
    playlistId,
    trackPath,
}: LibraryTrackRowProps) {
    const dragData = buildDragData(index);
    const listItemStyles = useListItemStyles();
    const isSelected = useValue(() => selectedIndices$.get().has(index));
    const isPlaying = useValue(() => {
        const currentTrack = audioPlayerState$.currentTrack.get();
        return currentTrack ? currentTrack.id === track.id : false;
    });
    const accentColor = useValue(() => themeState$.customColors.dark.accent.primary.get());
    const displayIndex = track.trackIndex;
    const numberColumn = columns.find((column) => column.id === "number") ?? columns[0];
    const titleColumn = columns.find((column) => column.id === "title") ?? columns[1];
    const artistColumn = columns.find((column) => column.id === "artist") ?? columns[2];
    const albumColumn = columns.find((column) => column.id === "album") ?? columns[3];
    const dateAddedColumn = columns.find((column) => column.id === "date-added");
    const durationColumn = columns.find((column) => column.id === "duration") ?? columns[columns.length - 3];
    const actionsColumn = columns.find((column) => column.id === "actions") ?? columns[columns.length - 2];
    const sourceColumn = columns.find((column) => column.id === "source") ?? columns[columns.length - 1];
    const addedAtLabel = formatAddedDate(track.addedAt);
    const ProviderBadge = track.provider ? getProviderPlugin(track.provider)?.ui?.badge ?? null : null;
    const providerBadgeNode = ProviderBadge ? <ProviderBadge size={12} className="opacity-80" /> : null;

    const handleMenuClick = useCallback(
        async (event: NativeMouseEvent) => {
            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;

            const selection = await showContextMenu(TRACK_ROW_MENU_ITEMS, { x, y });
            if (!selection) {
                return;
            }

            if (selection === "play-now" || selection === "play-next") {
                onMenuAction(index, selection);
            }
        },
        [index, onMenuAction],
    );

    const row = (
        <TableRow
            className="w-full"
            isSelected={isSelected}
            isActive={isPlaying}
            onClick={(event) => onClick(index, event)}
            onDoubleClick={(event) => onDoubleClick(index, event)}
            onRightClick={(event) => onRightClick(index, event)}
        >
            <TableCell column={numberColumn}>
                {isPlaying ? (
                    <Icon name="play.fill" size={12} color={accentColor} />
                ) : displayIndex != null ? (
                    <Text className={cn("text-xs tabular-nums", listItemStyles.text.muted)}>{displayIndex}</Text>
                ) : null}
            </TableCell>
            <TableCell column={titleColumn}>
                <Text className={cn("text-sm font-medium truncate", listItemStyles.text.primary)} numberOfLines={1}>
                    {track.title}
                </Text>
            </TableCell>
            <TableCell column={artistColumn}>
                <Text className={cn("text-sm truncate", listItemStyles.text.secondary)} numberOfLines={1}>
                    {track.artist}
                </Text>
            </TableCell>
            <TableCell column={albumColumn}>
                <Text className={cn("text-sm truncate", listItemStyles.text.secondary)} numberOfLines={1}>
                    {track.album ?? ""}
                </Text>
            </TableCell>
            {dateAddedColumn ? (
                <TableCell column={dateAddedColumn}>
                    <Text className={cn("text-xs truncate", listItemStyles.text.secondary)} numberOfLines={1}>
                        {addedAtLabel || "-"}
                    </Text>
                </TableCell>
            ) : null}
            <TableCell column={durationColumn}>
                <Text className={listItemStyles.getMetaClassName({ className: "text-xs" })}>{track.duration}</Text>
            </TableCell>
            <TableCell column={actionsColumn} className="pl-1 pr-1">
                <Button
                    icon="ellipsis"
                    variant="icon"
                    size="small"
                    accessibilityLabel="Track actions"
                    onClick={handleMenuClick}
                    className="bg-transparent hover:bg-white/10"
                />
            </TableCell>
            <TableCell column={sourceColumn} className="pl-1 pr-1">
                {providerBadgeNode}
            </TableCell>
        </TableRow>
    );

    if (Platform.OS === "macos") {
        return (
            <TrackDragSource
                tracks={dragData.tracks as NativeDragTrack[]}
                onDragStart={onNativeDragStart}
                className="flex-1"
            >
                {row}
            </TrackDragSource>
        );
    }

    if (isPlaylistEditable && playlistId && trackPath) {
        const playlistDragData = {
            type: "local-playlist-track",
            playlistId,
            trackPath,
            sourceIndex: index,
        } satisfies LocalPlaylistDragData;

        return (
            <DraggableItem
                id={`local-playlist-track-${playlistId}-${index}`}
                zoneId={LOCAL_PLAYLIST_DRAG_ZONE_ID}
                data={playlistDragData}
                className="flex-1"
            >
                {row}
            </DraggableItem>
        );
    }

    return (
        <DraggableItem
            id={`library-track-${track.id}`}
            zoneId={MEDIA_LIBRARY_DRAG_ZONE_ID}
            data={() => dragData}
            className="flex-1"
        >
            {row}
        </DraggableItem>
    );
}
