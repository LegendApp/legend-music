import { useValue } from "@legendapp/state/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    LayoutChangeEvent,
    type LayoutRectangle,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import type { NativeMouseEvent } from "react-native-macos";

import { Button } from "@/components/Button";
import {
    type DraggedItem,
    DroppableZone,
    MEDIA_LIBRARY_DRAG_ZONE_ID,
    type MediaLibraryDragData,
} from "@/components/dnd";
import { localAudioControls } from "@/components/LocalAudioPlayer";
import { NativeSidebar, SidebarItem } from "@/components/NativeSidebar";
import type { TextInputSearchRef } from "@/components/TextInputSearch";
import { showToast } from "@/components/Toast";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { type ContextMenuItem, showContextMenu } from "@/native-modules/ContextMenu";
import { DragDropView } from "@/native-modules/DragDropView";
import { showInFinder } from "@/native-modules/FileDialog";
import { activeProviderId$ } from "@/providers/providerRegistry";
import {
    fetchSpotifyPlaylists,
    isSpotifyAuthenticated$,
    spotifyPlaylists$,
    spotifyPlaylistsStatus$,
} from "@/providers/spotify";
import { SUPPORT_PLAYLISTS } from "@/systems/constants";
import { type LibraryView, libraryUI$, selectLibraryPlaylist, selectLibraryView } from "@/systems/LibraryState";
import { createLocalPlaylist, type LocalPlaylist, localMusicState$ } from "@/systems/LocalMusicState";
import {
    addTracksToPlaylist,
    deletePlaylist,
    duplicatePlaylistToCache,
    exportPlaylistToFile,
    renamePlaylist,
} from "@/systems/LocalPlaylists";
import { cn } from "@/utils/cn";
import { perfCount } from "@/utils/perfLogger";
import { getQueueAction } from "@/utils/queueActions";
import { buildTrackLookup, resolvePlaylistTracks } from "@/utils/trackResolution";
import { MediaLibrarySearchBar } from "./SearchBar";

const LIBRARY_VIEWS: { id: LibraryView; label: string; disabled?: boolean }[] = [
    { id: "artists", label: "Artists" },
    { id: "albums", label: "Albums" },
    { id: "songs", label: "Songs" },
    { id: "starred", label: "Starred", disabled: true },
];

const LOCAL_PLAYLIST_ITEM_PREFIX = "playlist-local:";
const SPOTIFY_PLAYLIST_ITEM_PREFIX = "playlist-spotify:";

const buildPlaylistItemId = (provider: "local" | "spotify", playlistId: string): string =>
    `${provider === "local" ? LOCAL_PLAYLIST_ITEM_PREFIX : SPOTIFY_PLAYLIST_ITEM_PREFIX}${playlistId}`;

interface MediaLibrarySidebarProps {
    useNativeLibraryList?: boolean;
}

export function MediaLibrarySidebar({ useNativeLibraryList = false }: MediaLibrarySidebarProps) {
    perfCount("MediaLibrary.Sidebar.render");
    const selectedView = useValue(libraryUI$.selectedView);
    const selectedPlaylistId = useValue(libraryUI$.selectedPlaylistId);
    const selectedPlaylistProvider = useValue(libraryUI$.selectedPlaylistProvider);
    const searchQuery = useValue(libraryUI$.searchQuery);
    const localPlaylists = useValue(localMusicState$.playlists);
    const activeProviderId = useValue(activeProviderId$);
    const isSpotifyAuthenticated = useValue(isSpotifyAuthenticated$);
    const spotifyPlaylists = useValue(spotifyPlaylists$.playlists);
    const spotifyPlaylistsLoading = useValue(spotifyPlaylistsStatus$.isLoading);
    const listItemStyles = useListItemStyles();
    const searchInputRef = useRef<TextInputSearchRef | null>(null);
    const [tempPlaylistId, setTempPlaylistId] = useState<string | null>(null);
    const [tempPlaylistName, setTempPlaylistName] = useState("");
    const [activeNativeDropPlaylistId, setActiveNativeDropPlaylistId] = useState<string | null>(null);
    const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
    const [editingPlaylistName, setEditingPlaylistName] = useState("");
    const shouldUseNativeLibraryList = useNativeLibraryList && Platform.OS === "macos";
    const isSpotifyProvider = activeProviderId === "spotify";
    const [outerWidth, setWidth] = useState(0);
    const width = Math.max(outerWidth - 28, 0);
    const showLocalPlaylists = SUPPORT_PLAYLISTS && !isSpotifyProvider;
    const showSpotifyPlaylists = SUPPORT_PLAYLISTS && isSpotifyProvider;

    useEffect(() => {
        if (!isSpotifyProvider || !isSpotifyAuthenticated) {
            return;
        }

        void fetchSpotifyPlaylists().catch((error) => {
            console.error("Failed to load Spotify playlists", error);
            showToast(error instanceof Error ? error.message : "Failed to load Spotify playlists", "error");
        });
    }, [isSpotifyAuthenticated, isSpotifyProvider]);

    const onNativeSidebarLayout = useCallback(
        (layout: { width: number; height: number }) => {
            setWidth(layout.width);
        },
        [setWidth],
    );
    const handleSelectView = useCallback((view: LibraryView) => {
        selectLibraryView(view);
    }, []);

    const handleAddPlaylist = useCallback(() => {
        console.log("handleAddPlaylist");
        if (isSpotifyProvider || tempPlaylistId) {
            return;
        }

        const id = `pl-temp-${Date.now()}`;
        const defaultName = "New Playlist";
        localMusicState$.playlists.push({
            id,
            name: defaultName,
            filePath: "",
            trackPaths: [],
            trackCount: 0,
            source: "cache",
        });
        setTempPlaylistId(id);
        setTempPlaylistName(defaultName);
        selectLibraryPlaylist(id, "local");
    }, [isSpotifyProvider, tempPlaylistId]);

    const finalizeTempPlaylist = useCallback(async () => {
        if (!tempPlaylistId) {
            return;
        }

        const name = tempPlaylistName.trim();
        const currentPlaylists = localMusicState$.playlists.peek();
        localMusicState$.playlists.set(currentPlaylists.filter((pl) => pl.id !== tempPlaylistId));

        setTempPlaylistId(null);
        setTempPlaylistName("");

        if (!name) {
            selectLibraryView("songs");
            return;
        }

        try {
            const playlist = await createLocalPlaylist(name);
            selectLibraryPlaylist(playlist.id, "local");
        } catch (error) {
            console.error("Failed to create playlist:", error);
            selectLibraryView("songs");
        }
    }, [tempPlaylistId, tempPlaylistName]);

    const cancelRename = useCallback(() => {
        setEditingPlaylistId(null);
        setEditingPlaylistName("");
    }, []);

    const finalizeRename = useCallback(async () => {
        if (!editingPlaylistId) {
            return;
        }

        const playlistId = editingPlaylistId;
        const nextName = editingPlaylistName.trim();
        cancelRename();

        if (!nextName) {
            return;
        }

        try {
            const result = await renamePlaylist(playlistId, nextName);
            if (result) {
                showToast(`Renamed playlist to ${result.playlistName}`, "info");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to rename playlist";
            showToast(message, "error");
        }
    }, [cancelRename, editingPlaylistId, editingPlaylistName]);

    const handlePlaylistDoubleClick = useCallback((playlist: LocalPlaylist, event?: NativeMouseEvent) => {
        const allTracks = localMusicState$.tracks.peek();
        if (allTracks.length === 0) {
            return;
        }

        const { tracks: resolvedTracks, missingPaths } = resolvePlaylistTracks(
            {
                id: playlist.id,
                name: playlist.name,
                type: playlist.source,
                trackPaths: playlist.trackPaths,
            },
            allTracks,
            buildTrackLookup(allTracks),
        );

        if (missingPaths.length > 0) {
            console.warn(`Playlist ${playlist.name} is missing ${missingPaths.length} tracks from the library`);
        }

        if (resolvedTracks.length === 0) {
            showToast(`No tracks found in ${playlist.name}`, "info");
            return;
        }

        const action = getQueueAction({ event });
        switch (action) {
            case "play-now":
                localAudioControls.queue.insertNext(resolvedTracks, { playImmediately: true });
                break;
            case "play-next":
                localAudioControls.queue.insertNext(resolvedTracks);
                break;
            default:
                localAudioControls.queue.append(resolvedTracks);
                break;
        }

        const addedLabel = resolvedTracks.length === 1 ? "track" : "tracks";
        showToast(`Added ${resolvedTracks.length} ${addedLabel} from ${playlist.name} to queue`, "info");
    }, []);

    const handleAddTracks = useCallback(async (playlistId: string, trackPaths: string[]) => {
        try {
            const { addedPaths, playlist } = await addTracksToPlaylist(playlistId, trackPaths);
            const addedCount = addedPaths.length;
            if (addedCount > 0) {
                let msg: string;
                if (addedCount === 1) {
                    msg = "track";
                } else {
                    msg = "tracks";
                }
                showToast(`Added ${addedCount} ${msg} to ${playlist.name}`, "info");
            } else {
                showToast("No new tracks to add", "info");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to add tracks to playlist";
            showToast(message, "error");
        }
    }, []);

    const handlePlaylistContextMenu = useCallback(
        async (playlist: LocalPlaylist, event: NativeMouseEvent, mode: "full" | "basic" = "full") => {
            const x = event.pageX ?? event.x ?? 0;
            const y = event.pageY ?? event.y ?? 0;

            const isEditable = playlist.source === "cache" && Boolean(playlist.filePath);
            const menuItems: ContextMenuItem[] = [];

            if (mode === "basic") {
                if (!isEditable) {
                    return;
                }

                menuItems.push({ id: "rename", title: "Rename" });
                menuItems.push({ id: "delete", title: "Delete" });
            } else if (isEditable) {
                menuItems.push({ id: "rename", title: "Rename" });
                menuItems.push({ id: "delete", title: "Delete" });
                menuItems.push({ id: "export", title: "Export .m3u" });
                menuItems.push({ id: "reveal", title: "Reveal in Finder" });
            } else {
                menuItems.push({ id: "import", title: "Import to Local Playlists" });
                menuItems.push({ id: "export", title: "Export .m3u" });
                menuItems.push({ id: "reveal", title: "Reveal in Finder" });
            }

            const selection = await showContextMenu(menuItems, { x, y });
            if (!selection) {
                return;
            }

            switch (selection) {
                case "rename":
                    setEditingPlaylistId(playlist.id);
                    setEditingPlaylistName(playlist.name);
                    return;
                case "delete":
                    Alert.alert("Delete playlist", `Delete “${playlist.name}”?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => {
                                void (async () => {
                                    try {
                                        await deletePlaylist(playlist.id);
                                        showToast(`Deleted ${playlist.name}`, "info");
                                    } catch (error) {
                                        const message =
                                            error instanceof Error ? error.message : "Failed to delete playlist";
                                        showToast(message, "error");
                                    }
                                })();
                            },
                        },
                    ]);
                    return;
                case "reveal": {
                    const didReveal = await showInFinder(playlist.filePath);
                    if (!didReveal) {
                        showToast("Unable to reveal playlist", "error");
                    }
                    return;
                }
                case "export": {
                    try {
                        const exportedPath = await exportPlaylistToFile(playlist.id);
                        if (exportedPath) {
                            await showInFinder(exportedPath);
                            showToast(`Exported ${playlist.name}`, "info");
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Failed to export playlist";
                        showToast(message, "error");
                    }
                    return;
                }
                case "import": {
                    try {
                        const nextPlaylist = await duplicatePlaylistToCache(playlist.id);
                        selectLibraryPlaylist(nextPlaylist.id, "local");
                        showToast(`Imported ${playlist.name}`, "info");
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Failed to import playlist";
                        showToast(message, "error");
                    }
                    return;
                }
                default:
                    return;
            }
        },
        [],
    );

    // Compute selected ID for native sidebar
    const nativeSidebarSelectedId = useMemo(() => {
        if (selectedView === "playlist" && selectedPlaylistId && selectedPlaylistProvider) {
            if (selectedPlaylistProvider === "spotify") {
                return buildPlaylistItemId("spotify", selectedPlaylistId);
            }
            if (selectedPlaylistProvider === "local") {
                return buildPlaylistItemId("local", selectedPlaylistId);
            }
        }
        return selectedView;
    }, [selectedPlaylistId, selectedPlaylistProvider, selectedView]);

    const handleNativeSidebarSelection = useCallback(
        (id: string) => {
            if (id.startsWith(LOCAL_PLAYLIST_ITEM_PREFIX)) {
                selectLibraryPlaylist(id.replace(LOCAL_PLAYLIST_ITEM_PREFIX, ""), "local");
                return;
            }

            if (id.startsWith(SPOTIFY_PLAYLIST_ITEM_PREFIX)) {
                selectLibraryPlaylist(id.replace(SPOTIFY_PLAYLIST_ITEM_PREFIX, ""), "spotify");
                return;
            }

            handleSelectView(id as LibraryView);
        },
        [handleSelectView],
    );

    // Native macOS sidebar with custom RN content
    if (shouldUseNativeLibraryList) {
        return (
            <NativeSidebar
                selectedId={nativeSidebarSelectedId}
                onSelectionChange={handleNativeSidebarSelection}
                contentInsetTop={0}
                className="flex-1 h-full"
                onLayout={onNativeSidebarLayout}
            >
                <SidebarItem itemId="header-search" selectable={false} rowHeight={48}>
                    <MediaLibrarySearchBar searchInputRef={searchInputRef} query={searchQuery} width={width + 8} />
                </SidebarItem>

                {/* Library Section Header */}
                <SidebarItem itemId="header-library" selectable={false} rowHeight={20}>
                    <Text className="text-xs font-semibold text-white/40 uppercase tracking-wider">Library</Text>
                </SidebarItem>

                {/* Library Views */}
                {LIBRARY_VIEWS.filter((view) => !view.disabled).map((view) => (
                    <SidebarItem key={view.id} itemId={view.id} className="py-2">
                        <Text className="text-sm text-text-primary pt-1">{view.label}</Text>
                    </SidebarItem>
                ))}

                {/* Playlists Section Header */}
                {SUPPORT_PLAYLISTS ? (
                    <SidebarItem itemId="header-playlists" selectable={false} rowHeight={36}>
                        <View className="flex-row items-center justify-between pt-3" style={{ width }}>
                            <Text className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                                {isSpotifyProvider ? "Spotify Playlists" : "Playlists"}
                            </Text>
                            {showLocalPlaylists ? (
                                <Button
                                    icon="plus"
                                    variant="icon-hover"
                                    size="small"
                                    accessibilityLabel="Add playlist"
                                    disabled={Boolean(tempPlaylistId)}
                                    onClick={handleAddPlaylist}
                                />
                            ) : null}
                        </View>
                    </SidebarItem>
                ) : null}

                {/* Playlist Items */}
                {showSpotifyPlaylists ? (
                    !isSpotifyAuthenticated ? (
                        <SidebarItem itemId="spotify-playlists-disabled" selectable={false}>
                            <Text className="text-sm text-white/40">Connect Spotify to view playlists</Text>
                        </SidebarItem>
                    ) : spotifyPlaylistsLoading ? (
                        <SidebarItem itemId="spotify-playlists-loading" selectable={false}>
                            <Text className="text-sm text-white/40">Loading Spotify playlists...</Text>
                        </SidebarItem>
                    ) : spotifyPlaylists.length === 0 ? (
                        <SidebarItem itemId="spotify-playlists-empty" selectable={false}>
                            <Text className="text-sm text-white/40">No Spotify playlists found</Text>
                        </SidebarItem>
                    ) : (
                        spotifyPlaylists.map((playlist) => (
                            <SidebarItem
                                key={playlist.id}
                                itemId={buildPlaylistItemId("spotify", playlist.id)}
                            >
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-sm text-text-primary flex-1 py-1" numberOfLines={1}>
                                        {playlist.name}
                                    </Text>
                                    <Text className="text-xs text-white/40">{playlist.trackCount ?? 0}</Text>
                                </View>
                            </SidebarItem>
                        ))
                    )
                ) : null}

                {showLocalPlaylists && localPlaylists.length === 0 ? (
                    <SidebarItem itemId="no-playlists" selectable={false}>
                        <Text className="text-sm text-white/40">No playlists yet</Text>
                    </SidebarItem>
                ) : null}

                {showLocalPlaylists
                    ? localPlaylists.map((playlist) => {
                          const isTemp = playlist.id === tempPlaylistId;
                          const isEditing = playlist.id === editingPlaylistId;

                          if (isTemp) {
                              return (
                                  <SidebarItem
                                      key={playlist.id}
                                      itemId={buildPlaylistItemId("local", playlist.id)}
                                  >
                                      <TextInput
                                          value={tempPlaylistName}
                                          onChangeText={setTempPlaylistName}
                                          onSubmitEditing={finalizeTempPlaylist}
                                          onBlur={finalizeTempPlaylist}
                                          autoFocus
                                          selectTextOnFocus
                                          placeholder="New Playlist"
                                          className="flex-1 text-sm text-text-primary"
                                      />
                                  </SidebarItem>
                              );
                          }

                          if (isEditing) {
                              return (
                                  <SidebarItem
                                      key={playlist.id}
                                      itemId={buildPlaylistItemId("local", playlist.id)}
                                  >
                                      <TextInput
                                          value={editingPlaylistName}
                                          onChangeText={setEditingPlaylistName}
                                          onSubmitEditing={finalizeRename}
                                          onBlur={finalizeRename}
                                          autoFocus
                                          selectTextOnFocus
                                          placeholder="Playlist name"
                                          className="flex-1 text-sm text-text-primary"
                                      />
                                  </SidebarItem>
                              );
                          }

                          return (
                              <SidebarItem
                                  key={playlist.id}
                                  itemId={buildPlaylistItemId("local", playlist.id)}
                                  onRightClick={(event) => handlePlaylistContextMenu(playlist, event, "basic")}
                              >
                                  <View className="flex-row items-center justify-between">
                                      <Text className="text-sm text-text-primary flex-1 py-1" numberOfLines={1}>
                                          {playlist.name}
                                      </Text>
                                      <Text className="text-xs text-white/40">{playlist.trackCount}</Text>
                                  </View>
                              </SidebarItem>
                          );
                      })
                    : null}

                {/* Sources Section */}
                {/* <SidebarItem itemId="header-sources" selectable={false} rowHeight={36}>
                    <Text className="text-xs font-semibold text-white/40 uppercase tracking-wider pt-3">Sources</Text>
                </SidebarItem>
                <SidebarItem itemId="source-local" selectable={false}>
                    <Text className="text-sm text-white/70">✓ Local Music</Text>
                </SidebarItem> */}
            </NativeSidebar>
        );
    }

    // Fallback: non-native sidebar
    return (
        <View className="flex-1 min-h-0">
            <MediaLibrarySearchBar searchInputRef={searchInputRef} query={searchQuery} />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="pb-3">
                    <Text className="px-3 pt-2 pb-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
                        Library
                    </Text>
                    {LIBRARY_VIEWS.map((view) => {
                        const isSelected = selectedView === view.id;
                        return (
                            <Button
                                key={view.id}
                                disabled={view.disabled}
                                className={listItemStyles.getRowClassName({
                                    variant: "compact",
                                    isSelected,
                                    isInteractive: !view.disabled,
                                })}
                                onClick={() => handleSelectView(view.id)}
                            >
                                <Text
                                    className={cn(
                                        "text-sm truncate flex-1 pr-4",
                                        isSelected ? listItemStyles.text.primary : listItemStyles.text.secondary,
                                        view.disabled ? "opacity-40" : "",
                                    )}
                                    numberOfLines={1}
                                >
                                    {view.label}
                                </Text>
                            </Button>
                        );
                    })}
                </View>

                {SUPPORT_PLAYLISTS ? (
                    <View className="pb-3">
                        <View className="flex-row items-center justify-between px-3 pt-2 pb-1">
                            <Text className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                                {isSpotifyProvider ? "Spotify Playlists" : "Playlists"}
                            </Text>
                            {showLocalPlaylists ? (
                                <Button
                                    icon="plus"
                                    variant="icon"
                                    size="small"
                                    accessibilityLabel="Add playlist"
                                    disabled={Boolean(tempPlaylistId)}
                                    onClick={handleAddPlaylist}
                                    className="bg-transparent hover:bg-white/10"
                                />
                            ) : null}
                        </View>

                        {showSpotifyPlaylists ? (
                            !isSpotifyAuthenticated ? (
                                <View className="px-3 py-1">
                                    <Text className="text-sm text-white/40">Connect Spotify to view playlists</Text>
                                </View>
                            ) : spotifyPlaylistsLoading ? (
                                <View className="px-3 py-1">
                                    <Text className="text-sm text-white/40">Loading Spotify playlists...</Text>
                                </View>
                            ) : spotifyPlaylists.length === 0 ? (
                                <View className="px-3 py-1">
                                    <Text className="text-sm text-white/40">No Spotify playlists found</Text>
                                </View>
                            ) : (
                                spotifyPlaylists.map((playlist) => {
                                    const isSelected =
                                        selectedView === "playlist" &&
                                        selectedPlaylistProvider === "spotify" &&
                                        selectedPlaylistId === playlist.id;
                                    return (
                                        <Button
                                            key={playlist.id}
                                            className={listItemStyles.getRowClassName({
                                                variant: "compact",
                                                isSelected,
                                            })}
                                            onClick={() => selectLibraryPlaylist(playlist.id, "spotify")}
                                        >
                                            <View className="flex-1 flex-row items-center justify-between overflow-hidden">
                                                <Text
                                                    className={cn(
                                                        "text-sm truncate flex-1 pr-2",
                                                        isSelected
                                                            ? listItemStyles.text.primary
                                                            : listItemStyles.text.secondary,
                                                    )}
                                                    numberOfLines={1}
                                                >
                                                    {playlist.name}
                                                </Text>
                                                <Text className={listItemStyles.getMetaClassName()}>
                                                    {playlist.trackCount ?? 0}
                                                </Text>
                                            </View>
                                        </Button>
                                    );
                                })
                            )
                        ) : null}

                        {showLocalPlaylists && localPlaylists.length === 0 ? (
                            <View className="px-3 py-1">
                                <Text className="text-sm text-white/40">No playlists yet</Text>
                            </View>
                        ) : null}

                        {showLocalPlaylists
                            ? localPlaylists.map((playlist) => {
                                  const isSelected =
                                      selectedView === "playlist" &&
                                      selectedPlaylistProvider === "local" &&
                                      selectedPlaylistId === playlist.id;
                                  const isTemp = playlist.id === tempPlaylistId;
                                  const isEditing = playlist.id === editingPlaylistId;
                                  const isDroppable = playlist.source === "cache" && Boolean(playlist.filePath);
                                  const isNativeDropActive =
                                      Platform.OS === "macos" &&
                                      isDroppable &&
                                      activeNativeDropPlaylistId === playlist.id;

                                  if (isTemp) {
                                      return (
                                          <View
                                              key={playlist.id}
                                              className={listItemStyles.getRowClassName({
                                                  variant: "compact",
                                                  isSelected: true,
                                                  isInteractive: false,
                                              })}
                                          >
                                              <TextInput
                                                  value={tempPlaylistName}
                                                  onChangeText={setTempPlaylistName}
                                                  onSubmitEditing={finalizeTempPlaylist}
                                                  onBlur={finalizeTempPlaylist}
                                                  autoFocus
                                                  selectTextOnFocus
                                                  placeholder="New Playlist"
                                                  className="flex-1 text-sm text-text-primary"
                                              />
                                          </View>
                                      );
                                  }

                                  if (isEditing) {
                                      return (
                                          <View
                                              key={playlist.id}
                                              className={listItemStyles.getRowClassName({
                                                  variant: "compact",
                                                  isSelected: true,
                                                  isInteractive: false,
                                              })}
                                          >
                                              <TextInput
                                                  value={editingPlaylistName}
                                                  onChangeText={setEditingPlaylistName}
                                                  onSubmitEditing={finalizeRename}
                                                  onBlur={finalizeRename}
                                                  autoFocus
                                                  selectTextOnFocus
                                                  placeholder="Playlist name"
                                                  className="flex-1 text-sm text-text-primary"
                                              />
                                          </View>
                                      );
                                  }

                                  const renderRow = (className?: string) => (
                                      <Button
                                          className={cn(
                                              listItemStyles.getRowClassName({
                                                  variant: "compact",
                                                  isSelected,
                                              }),
                                              className,
                                          )}
                                          onClick={() => selectLibraryPlaylist(playlist.id, "local")}
                                          onDoubleClick={(event) => handlePlaylistDoubleClick(playlist, event)}
                                          onRightClick={(event) => handlePlaylistContextMenu(playlist, event)}
                                      >
                                          <View className="flex-1 flex-row items-center justify-between overflow-hidden">
                                              <Text
                                                  className={cn(
                                                      "text-sm truncate flex-1 pr-2",
                                                      isSelected
                                                          ? listItemStyles.text.primary
                                                          : listItemStyles.text.secondary,
                                                  )}
                                                  numberOfLines={1}
                                              >
                                                  {playlist.name}
                                              </Text>
                                              <Text className={listItemStyles.getMetaClassName()}>
                                                  {playlist.trackCount}
                                              </Text>
                                          </View>
                                      </Button>
                                  );

                                  if (Platform.OS === "macos") {
                                      return (
                                          <DragDropView
                                              key={playlist.id}
                                              className={cn(
                                                  "relative",
                                                  isNativeDropActive
                                                      ? "bg-blue-500/15 border border-blue-400/50"
                                                      : "",
                                              )}
                                              onTrackDragEnter={() => {
                                                  if (isDroppable) {
                                                      setActiveNativeDropPlaylistId(playlist.id);
                                                  }
                                              }}
                                              onTrackDragLeave={() => {
                                                  setActiveNativeDropPlaylistId((prev) =>
                                                      prev === playlist.id ? null : prev,
                                                  );
                                              }}
                                              onTrackDrop={(event) => {
                                                  setActiveNativeDropPlaylistId((prev) =>
                                                      prev === playlist.id ? null : prev,
                                                  );
                                                  const tracks = event.nativeEvent.tracks ?? [];
                                                  const trackPaths = tracks
                                                      .map((track) => track.filePath ?? track.id)
                                                      .filter(
                                                          (path): path is string =>
                                                              Boolean(path) && !path.startsWith("spotify:"),
                                                      );
                                                  if (isDroppable && trackPaths.length > 0) {
                                                      void handleAddTracks(playlist.id, trackPaths);
                                                  }
                                              }}
                                          >
                                              {renderRow()}
                                          </DragDropView>
                                      );
                                  }

                                  if (!isDroppable) {
                                      return <View key={playlist.id}>{renderRow()}</View>;
                                  }

                                  return (
                                      <View key={playlist.id} className="relative">
                                          <DroppableZone
                                              id={`library-playlist-drop-${playlist.id}`}
                                              className="absolute inset-0"
                                              allowDrop={(item: DraggedItem) => {
                                                  if (item.sourceZoneId !== MEDIA_LIBRARY_DRAG_ZONE_ID) {
                                                      return false;
                                                  }

                                                  const data = item.data as MediaLibraryDragData;
                                                  if (!data || data.type !== "media-library-tracks") {
                                                      return false;
                                                  }

                                                  return data.tracks.some((track) => track.provider !== "spotify");
                                              }}
                                              onDrop={(item: DraggedItem) => {
                                                  const data = item.data as MediaLibraryDragData;
                                                  if (data?.type !== "media-library-tracks") {
                                                      return;
                                                  }

                                                  const trackPaths = data.tracks
                                                      .filter((track) => track.provider !== "spotify")
                                                      .map((track) => track.filePath)
                                                      .filter((path): path is string => Boolean(path));
                                                  if (trackPaths.length === 0) {
                                                      return;
                                                  }

                                                  void handleAddTracks(playlist.id, trackPaths);
                                              }}
                                          >
                                              {(isActive) =>
                                                  isActive ? (
                                                      <View className="absolute inset-0 rounded-md bg-blue-500/15 border border-blue-400/50" />
                                                  ) : null
                                              }
                                          </DroppableZone>
                                          {renderRow()}
                                      </View>
                                  );
                              })
                            : null}
                    </View>
                ) : null}

                <View className="pb-6">
                    <Text className="px-3 pt-2 pb-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
                        Sources
                    </Text>
                    <View className="px-3 py-1">
                        <Text className="text-sm text-white/70">✓ Local Music</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
