import { LegendList } from "@legendapp/list";
import { type Observable, observable } from "@legendapp/state";
import { useObservable, useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";
import { audioPlayerState$ } from "@/components/AudioPlayer";
import { Button } from "@/components/Button";
import { DropdownMenu } from "@/components/DropdownMenu";
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
import { Select } from "@/components/Select";
import { SkiaSpinner } from "@/components/SkiaSpinner";
import { Table, TableCell, type TableColumnSpec, TableHeader, TableRow } from "@/components/Table";
import { showToast } from "@/components/Toast";
import type { TrackData } from "@/components/TrackItem";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { type ContextMenuItem, showContextMenu } from "@/native-modules/ContextMenu";
import { NativeButton } from "@/native-modules/NativeButton";
import { NativeButtonGroup } from "@/native-modules/NativeButtonGroup";
import { TitlebarAccessoryView } from "@/native-modules/TitlebarAccessoryView";
import { type NativeDragTrack, TrackDragSource } from "@/native-modules/TrackDragSource";
import { getStreamingProviderPlugin } from "@/providers/pluginRegistry";
import type { StreamingProviderPlaylist } from "@/providers/types";
import { aiPlaylistFillState$, finishAiPlaylistFill, startAiPlaylistFill } from "@/systems/ai";
import { buildPlaylistEntries } from "@/systems/ai/playlistTracks";
import { AI_PROMPT_SOURCE_OPTIONS, type AiPromptSource, getAiPromptPlaceholder } from "@/systems/ai/promptSource";
import { generatePlaylistSummary } from "@/systems/ai/summary";
import { Icon } from "@/systems/Icon";
import KeyboardManager, { KeyCodes } from "@/systems/keyboard/KeyboardManager";
import { libraryUI$, selectLibraryAlbum, selectLibraryArtist } from "@/systems/LibraryState";
import { type LocalPlaylist, localMusicState$, saveLocalPlaylistTracks } from "@/systems/LocalMusicState";
import { addTracksToPlaylist, updatePlaylistMetadata } from "@/systems/LocalPlaylists";
import { settings$ } from "@/systems/Settings";
import { fetchSuggestions } from "@/systems/suggestions";
import { themeState$ } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import type { QueueAction } from "@/utils/queueActions";
import { startTrackMix, TRACK_CONTEXT_MENU_ITEMS } from "@/utils/trackContextMenu";
import { AiPlaylistDropdown } from "./AiPlaylistDropdown";
import { useLibraryTrackList } from "./useLibraryTrackList";

type TrackListProps = {};

const emptyProviderPlaylists$ = observable([] as StreamingProviderPlaylist[]);
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

const getItemType = (item: TrackData) => {
    return item.isSeparator ? "separator" : "track";
};

const getFixedItemSize = (_: number, item: TrackData) => {
    return item.isSeparator ? 72 : 32;
};

export function TrackList(_props: TrackListProps) {
    const {
        tracks,
        selectedIndices$,
        handleTrackClick,
        handleTrackDoubleClick,
        handleTrackContextMenu,
        handleTrackQueueAction,
        handleSectionPlay,
        handleSectionEnqueue,
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
    const providerPlugin = selectedPlaylistProvider ? getStreamingProviderPlugin(selectedPlaylistProvider) : null;
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

    const extendPromptOpen$ = useObservable(false);
    const extendPromptOpen = useValue(extendPromptOpen$);
    const extendPromptInputRef = useRef<TextInput>(null);
    const [extendPromptDraft, setExtendPromptDraft] = useState("");
    const defaultPromptSource = useValue(settings$.ai.promptSource);
    const [extendPromptSource, setExtendPromptSource] = useState<AiPromptSource>(defaultPromptSource);
    const [extendPromptError, setExtendPromptError] = useState<string | null>(null);
    const [isExtending, setIsExtending] = useState(false);
    const aiPrompt = selectedLocalPlaylist?.aiPrompt?.trim() ?? "";
    const aiSummary = selectedLocalPlaylist?.aiSummary?.trim() ?? "";
    const playlistPromptSource = selectedLocalPlaylist?.aiSource ?? defaultPromptSource;
    const showAiSummary = Boolean(aiPrompt && aiSummary);
    const canModifyPlaylist = Boolean(selectedLocalPlaylist && selectedLocalPlaylist.source === "cache");

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

    const closeExtendPrompt = useCallback(() => {
        extendPromptOpen$.set(false);
    }, [extendPromptOpen$]);

    const isAiBusy = isExtending;
    const canExtendWithExistingPrompt = Boolean(aiPrompt && canModifyPlaylist && !isAiBusy);
    const canExtendWithNewPrompt = Boolean(canModifyPlaylist && !isAiBusy);

    const extendPlaylist = useCallback(
        async (
            promptValue: string,
            options: {
                updateMetadata?: boolean;
                promptSource?: AiPromptSource;
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
            const resolvedPromptSource = options.promptSource ?? playlistPromptSource;
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
                    promptSource: resolvedPromptSource,
                    cachePrompt: trimmedPrompt,
                    excludeTrackIds: selectedLocalPlaylist.trackPaths,
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
                            aiSource: resolvedPromptSource,
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
        [canModifyPlaylist, isAiBusy, playlistPromptSource, selectedLocalPlaylist],
    );

    const handleExtendExistingPrompt = useCallback(() => {
        console.log("[TrackList] handleExtendExistingPrompt called");
        if (!aiPrompt) {
            showToast("No AI prompt found for this playlist.", "info");
            return;
        }

        void extendPlaylist(aiPrompt, { promptSource: playlistPromptSource });
    }, [aiPrompt, extendPlaylist, playlistPromptSource]);

    const handleExtendWithNewPrompt = useCallback(() => {
        void extendPlaylist(extendPromptDraft, {
            updateMetadata: true,
            promptSource: extendPromptSource,
            onError: (message) => setExtendPromptError(message),
            onSuccess: closeExtendPrompt,
        });
    }, [closeExtendPrompt, extendPlaylist, extendPromptDraft, extendPromptSource]);

    useEffect(() => {
        if (!extendPromptOpen) {
            return;
        }

        setExtendPromptDraft("");
        setExtendPromptError(null);
        setExtendPromptSource(playlistPromptSource);
        setTimeout(() => {
            extendPromptInputRef.current?.focus();
        }, 0);
    }, [extendPromptOpen, playlistPromptSource]);

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

    const showExtendButtons =
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
                const sectionId = item.sectionId;
                return (
                    <LibrarySectionRow
                        title={item.sectionTitle ?? item.title}
                        count={item.sectionCount ?? 0}
                        onPlay={sectionId ? () => handleSectionPlay(sectionId) : undefined}
                        onEnqueue={sectionId ? () => handleSectionEnqueue(sectionId) : undefined}
                    />
                );
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
            handleSectionEnqueue,
            handleSectionPlay,
            handleNativeDragStart,
            handleDropAtPosition,
            isPlaylistEditable,
            selectedLocalPlaylist,
            selectedIndices$,
            columns,
        ],
    );

    return (
        <View className="flex-1 pl-2 relative">
            {headerConfig ? (
                <TitlebarAccessoryView>
                    <View className="px-3 py-2 flex-row items-center gap-3">
                    <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                        {headerConfig.title}
                    </Text>
                    <Text className="text-xs text-text-secondary" numberOfLines={1}>
                        ({headerConfig.count})
                    </Text>
                    {showAiSummary ? (
                        <View className="max-w-[45%] items-end">
                            <Text className="text-xs text-text-secondary text-right" numberOfLines={1}>
                                ✨ {aiSummary}
                            </Text>
                        </View>
                    ) : null}
                    <View className="flex-1" />
                    {showExtendButtons ? (
                        <DropdownMenu.Root isOpen$={extendPromptOpen$}>
                            <DropdownMenu.Trigger asChild disabled={!canExtendWithNewPrompt}>
                                <View collapsable={false}>
                                    <NativeButtonGroup style={{ width: 66, height: 28 }}>
                                        <NativeButton
                                            sfSymbol="sparkles"
                                            onPress={handleExtendExistingPrompt}
                                            disabled={!canExtendWithExistingPrompt}
                                            style={{ width: 28, height: 28 }}
                                        />
                                        <NativeButton
                                            sfSymbol="wand.and.sparkles"
                                            onPress={() => {
                                                console.log("[TrackList] wand button onPress called");
                                                extendPromptOpen$.set(true);
                                            }}
                                            disabled={!canExtendWithNewPrompt}
                                            style={{ width: 28, height: 28 }}
                                        />
                                    </NativeButtonGroup>
                                </View>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content
                                directionalHint="bottomRightEdge"
                                minWidth={360}
                                maxWidth={360}
                                setInitialFocus
                                scrolls={false}
                            >
                                <View className="p-3 bg-background-tertiary border border-border-primary rounded-md gap-2">
                                    <Text className="text-text-secondary text-xs font-medium">
                                        Extend with new prompt
                                    </Text>
                                    <View className="flex-row items-center justify-between gap-2">
                                        <Text className="text-text-secondary text-xs font-medium">Source</Text>
                                        <Select
                                            value={extendPromptSource}
                                            options={AI_PROMPT_SOURCE_OPTIONS}
                                            onValueChange={(value) => setExtendPromptSource(value as AiPromptSource)}
                                            triggerClassName="w-44"
                                            minWidth="auto"
                                        />
                                    </View>
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
                                            placeholder={getAiPromptPlaceholder(extendPromptSource, "playlist")}
                                            placeholderTextColor="#6b7280"
                                            multiline
                                            className="text-sm text-text-primary min-h-16"
                                        />
                                    </View>
                                    {extendPromptError ? (
                                        <View className="rounded-md border border-border-primary/60 bg-red-500/10 px-3 py-2">
                                            <Text className="text-sm text-red-200">{extendPromptError}</Text>
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
                    ) : null}
                    </View>
                </TitlebarAccessoryView>
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
            {showAiFillSpinner ? (
                <View pointerEvents="none" className="absolute left-4 right-4 bottom-3">
                    <View className="flex-row items-center gap-2 rounded-md bg-background-tertiary border border-border-primary px-3 py-2">
                        <SkiaSpinner size={18} color="#7dd6ff" trailColor="rgba(255,255,255,0.08)" />
                        <Text className="text-sm text-text-secondary">Generating AI tracks...</Text>
                    </View>
                </View>
            ) : null}
        </View>
    );
}

function LibrarySectionRow({
    title,
    count,
    onPlay,
    onEnqueue,
}: {
    title: string;
    count: number;
    onPlay?: () => void;
    onEnqueue?: () => void;
}) {
    const displayTitle = title.replace(/^— (.+) —$/, "$1");
    const hasActions = Boolean(onPlay || onEnqueue);
    const countLabel = count === 1 ? "1 track" : `${count} tracks`;

    return (
        <View className="pl-4 pr-3 pt-5 pb-2 border-b border-border-primary flex-row items-center gap-2 group">
            <View className="flex-1">
                <Text className="text-white/90 text-lg font-bold" numberOfLines={1}>
                    {displayTitle}
                </Text>
                <Text className="text-xs text-text-secondary" numberOfLines={1}>
                    {countLabel}
                </Text>
            </View>
            {hasActions ? (
                <View className="flex-row items-center gap-1">
                    {onPlay ? (
                        <Button
                            icon="play.fill"
                            variant="icon"
                            size="small"
                            tooltip={`Play all ${displayTitle}`}
                            className="opacity-40 group-hover:opacity-100"
                            onClick={onPlay}
                        />
                    ) : null}
                    {onEnqueue ? (
                        <Button
                            icon="plus"
                            variant="icon"
                            size="small"
                            tooltip={`Queue all ${displayTitle}`}
                            className="opacity-40 group-hover:opacity-100"
                            onClick={onEnqueue}
                        />
                    ) : null}
                </View>
            ) : null}
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

const buildTrackRowMenuItems = (track: TrackData): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
        { id: "play-now", title: "Play Now" },
        { id: "play-next", title: "Play Next" },
    ];

    items.push(TRACK_CONTEXT_MENU_ITEMS.startMixStreaming, TRACK_CONTEXT_MENU_ITEMS.startMixLibrary);

    if (track.artist?.trim()) {
        items.push(TRACK_CONTEXT_MENU_ITEMS.goToArtist);
    }

    if (track.album?.trim()) {
        items.push(TRACK_CONTEXT_MENU_ITEMS.goToAlbum);
    }

    items.push({ id: "star", title: "Star", enabled: false });
    return items;
};

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
    const ProviderBadge = track.provider ? (getStreamingProviderPlugin(track.provider)?.ui?.badge ?? null) : null;
    const providerBadgeNode = ProviderBadge ? <ProviderBadge size={12} className="opacity-80" /> : null;

    const handleMenuClick = useCallback(
        async (event: NativeMouseEvent) => {
            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;
            const menuItems = buildTrackRowMenuItems(track);
            const selection = await showContextMenu(menuItems, { x, y });
            if (!selection) {
                return;
            }

            if (selection === "play-now" || selection === "play-next") {
                onMenuAction(index, selection);
                return;
            }

            if (selection === TRACK_CONTEXT_MENU_ITEMS.startMixStreaming.id) {
                await startTrackMix(track, "streaming");
                return;
            }

            if (selection === TRACK_CONTEXT_MENU_ITEMS.startMixLibrary.id) {
                await startTrackMix(track, "local-library");
                return;
            }

            if (selection === TRACK_CONTEXT_MENU_ITEMS.goToArtist.id && track.artist?.trim()) {
                selectLibraryArtist(track.artist);
                return;
            }

            if (selection === TRACK_CONTEXT_MENU_ITEMS.goToAlbum.id && track.album?.trim()) {
                selectLibraryAlbum(track.album, track.artist);
            }
        },
        [index, onMenuAction, track],
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
