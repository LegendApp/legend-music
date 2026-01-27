import { LegendList } from "@legendapp/list";
import { useValue } from "@legendapp/state/react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import type { NativeMouseEvent } from "react-native-macos";
import { audioControls, audioPlayerState$ } from "@/components/AudioPlayer";
import { Button } from "@/components/Button";
import { SkiaSpinner } from "@/components/SkiaSpinner";
import { Table, TableCell, type TableColumnSpec, TableHeader, TableRow } from "@/components/Table";
import { useListItemStyles } from "@/hooks/useListItemStyles";
import { showContextMenu } from "@/native-modules/ContextMenu";
import {
    fetchAppleMusicAlbumTracks,
    fetchAppleMusicArtistTracks,
    isAppleMusicSearchEnabled$,
} from "@/providers/appleMusic/search";
import { buildAppleMusicLocalTrack } from "@/providers/appleMusic/trackMapping";
import {
    fetchSpotifyAlbumTracks,
    fetchSpotifyArtistTracks,
    isSpotifySearchEnabled$,
} from "@/providers/spotify/search";
import { buildSpotifyLocalTrack } from "@/providers/spotify/trackMapping";
import { Icon } from "@/systems/Icon";
import {
    getArtistKey,
    library$,
    libraryUI$,
    normalizeArtistName,
    selectLibraryView,
    type LibraryDetail,
} from "@/systems/LibraryState";
import type { LocalTrack } from "@/systems/LocalMusicState";
import { cn } from "@/utils/cn";
import { getQueueAction } from "@/utils/queueActions";
import { buildTrackContextMenuItems, handleTrackContextMenuSelection } from "@/utils/trackContextMenu";

type SectionStatus = "idle" | "loading" | "ready" | "disabled" | "error";

type SectionState = {
    status: SectionStatus;
    tracks: LocalTrack[];
    error?: string | null;
};

const SPOTIFY_DETAIL_MAX_RESULTS = 200;

const tableColumns: TableColumnSpec[] = [
    { id: "number", label: "#", width: 36, align: "right" },
    { id: "title", label: "Title", flex: 3, minWidth: 160 },
    { id: "artist", label: "Artist", flex: 2, minWidth: 140 },
    { id: "album", label: "Album", flex: 2, minWidth: 140 },
    { id: "duration", label: "Time", width: 64, align: "right" },
];

const spotifyTableColumns: TableColumnSpec[] = [
    ...tableColumns,
    { id: "popularity", label: "Popularity", width: 96, align: "right" },
];

const getColumn = (columns: TableColumnSpec[], id: string, fallbackIndex: number): TableColumnSpec =>
    columns.find((column) => column.id === id) ?? columns[fallbackIndex];

const getDetailHeading = (detail: LibraryDetail | null): { title: string; subtitle: string } => {
    if (!detail) {
        return { title: "Library", subtitle: "" };
    }

    if (detail.type === "artist") {
        return { title: normalizeArtistName(detail.name), subtitle: "Artist" };
    }

    const albumTitle = detail.name.trim();
    const artist = detail.artist?.trim();
    return { title: albumTitle, subtitle: artist ? `Album • ${artist}` : "Album" };
};

const formatDuration = (value: string): string => {
    if (!value) {
        return " ";
    }

    if (value.includes(":")) {
        return value;
    }

    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) {
        return value;
    }

    const mins = Math.floor(numeric / 60);
    const secs = Math.round(numeric % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const filterTracksByQuery = (tracks: LocalTrack[], query: string): LocalTrack[] => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return tracks;
    }

    return tracks.filter((track) => {
        const title = track.title?.toLowerCase() ?? "";
        const artist = track.artist?.toLowerCase() ?? "";
        const album = track.album?.toLowerCase() ?? "";
        return title.includes(normalized) || artist.includes(normalized) || album.includes(normalized);
    });
};

const filterLocalTracks = (tracks: LocalTrack[], detail: LibraryDetail | null): LocalTrack[] => {
    if (!detail) {
        return [];
    }

    if (detail.type === "artist") {
        const detailKey = getArtistKey(detail.name);
        return tracks.filter((track) => getArtistKey(track.artist) === detailKey);
    }

    const albumKey = detail.name.trim().toLowerCase();
    const artistKey = detail.artist ? getArtistKey(detail.artist) : null;
    return tracks.filter((track) => {
        const albumName = track.album?.trim() ?? "";
        if (!albumName || albumName.toLowerCase() !== albumKey) {
            return false;
        }
        if (artistKey) {
            return getArtistKey(track.artist) === artistKey;
        }
        return true;
    });
};

const toSectionState = (status: SectionStatus): SectionState => ({ status, tracks: [], error: null });

const SectionHeader = ({ title, count }: { title: string; count: string }) => (
    <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-white/90">{title}</Text>
        <Text className="text-xs text-white/50">{count}</Text>
    </View>
);

const DetailTrackRow = ({
    track,
    index,
    columns,
    onQueueAction,
    onRightClick,
}: {
    track: LocalTrack;
    index: number;
    columns: TableColumnSpec[];
    onQueueAction: (track: LocalTrack, event?: NativeMouseEvent) => void;
    onRightClick: (track: LocalTrack, event: NativeMouseEvent) => void;
}) => {
    const listItemStyles = useListItemStyles();
    const isPlaying = useValue(() => {
        const currentTrack = audioPlayerState$.currentTrack.get();
        return currentTrack ? currentTrack.id === track.id : false;
    });

    const displayIndex = typeof track.trackNumber === "number" ? track.trackNumber : index + 1;
    const numberColumn = getColumn(columns, "number", 0);
    const titleColumn = getColumn(columns, "title", 1);
    const artistColumn = getColumn(columns, "artist", 2);
    const albumColumn = getColumn(columns, "album", 3);
    const durationColumn = getColumn(columns, "duration", 4);

    return (
        <TableRow
            className="w-full"
            isActive={isPlaying}
            onDoubleClick={(event) => onQueueAction(track, event)}
            onRightClick={(event) => onRightClick(track, event)}
        >
            <TableCell column={numberColumn}>
                <Text className={cn("text-xs tabular-nums", listItemStyles.text.muted)}>{displayIndex}</Text>
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
            <TableCell column={durationColumn}>
                <Text className={listItemStyles.getMetaClassName({ className: "text-xs" })}>
                    {formatDuration(track.duration)}
                </Text>
            </TableCell>
        </TableRow>
    );
};

const SpotifyTrackRow = ({
    track,
    index,
    columns,
    onQueueAction,
    onRightClick,
}: {
    track: LocalTrack;
    index: number;
    columns: TableColumnSpec[];
    onQueueAction: (track: LocalTrack, event?: NativeMouseEvent) => void;
    onRightClick: (track: LocalTrack, event: NativeMouseEvent) => void;
}) => {
    const listItemStyles = useListItemStyles();
    const isPlaying = useValue(() => {
        const currentTrack = audioPlayerState$.currentTrack.get();
        return currentTrack ? currentTrack.id === track.id : false;
    });

    const displayIndex = typeof track.trackNumber === "number" ? track.trackNumber : index + 1;
    const numberColumn = getColumn(columns, "number", 0);
    const titleColumn = getColumn(columns, "title", 1);
    const artistColumn = getColumn(columns, "artist", 2);
    const albumColumn = getColumn(columns, "album", 3);
    const durationColumn = getColumn(columns, "duration", 4);
    const popularityColumn = columns.find((column) => column.id === "popularity");
    const popularityLabel = typeof track.popularity === "number" ? `${track.popularity}` : "-";

    return (
        <TableRow
            className="w-full"
            isActive={isPlaying}
            onDoubleClick={(event) => onQueueAction(track, event)}
            onRightClick={(event) => onRightClick(track, event)}
        >
            <TableCell column={numberColumn}>
                <Text className={cn("text-xs tabular-nums", listItemStyles.text.muted)}>{displayIndex}</Text>
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
            <TableCell column={durationColumn}>
                <Text className={listItemStyles.getMetaClassName({ className: "text-xs" })}>
                    {formatDuration(track.duration)}
                </Text>
            </TableCell>
            {popularityColumn ? (
                <TableCell column={popularityColumn}>
                    <Text className={listItemStyles.getMetaClassName({ className: "text-xs" })}>
                        {popularityLabel}
                    </Text>
                </TableCell>
            ) : null}
        </TableRow>
    );
};

const DetailSection = ({
    title,
    state,
    filteredTracks,
    onQueueAction,
    onRightClick,
    columns,
    renderRow,
}: {
    title: string;
    state: SectionState;
    filteredTracks: LocalTrack[];
    onQueueAction: (track: LocalTrack, event?: NativeMouseEvent) => void;
    onRightClick: (track: LocalTrack, event: NativeMouseEvent) => void;
    columns?: TableColumnSpec[];
    renderRow?: (track: LocalTrack, index: number) => ReactNode;
}) => {
    const listItemStyles = useListItemStyles();
    const resolvedColumns = columns ?? tableColumns;

    const statusLabel = useMemo(() => {
        if (state.status === "disabled") {
            return "Not connected";
        }
        if (state.status === "loading") {
            return "Loading...";
        }
        if (state.status === "error") {
            return "Error";
        }
        return `${filteredTracks.length} ${filteredTracks.length === 1 ? "track" : "tracks"}`;
    }, [filteredTracks.length, state.status]);

    const emptyLabel = useMemo(() => {
        if (state.status === "disabled") {
            return "Connect this provider to view tracks.";
        }
        if (state.status === "loading") {
            return "Loading tracks...";
        }
        if (state.status === "error") {
            return state.error || "Failed to load tracks.";
        }
        return "No tracks found";
    }, [state.error, state.status]);

    return (
        <View className="gap-2">
            <SectionHeader title={title} count={statusLabel} />
            <Table
                header={<TableHeader columns={resolvedColumns} />}
                bodyClassName={filteredTracks.length ? undefined : "items-center justify-center"}
                className="min-h-[140px]"
            >
                {state.status === "loading" && filteredTracks.length === 0 ? (
                    <View className="flex-1 items-center justify-center gap-2">
                        <SkiaSpinner size={20} color="#7dd6ff" trailColor="rgba(255,255,255,0.08)" />
                        <Text className="text-xs text-white/50">{emptyLabel}</Text>
                    </View>
                ) : filteredTracks.length === 0 ? (
                    <View className="flex-1 items-center justify-center">
                        <Text className="text-xs text-white/50">{emptyLabel}</Text>
                    </View>
                ) : (
                    <LegendList
                        data={filteredTracks}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item, index }) =>
                            renderRow ? (
                                renderRow(item, index)
                            ) : (
                                <DetailTrackRow
                                    track={item}
                                    index={index}
                                    columns={resolvedColumns}
                                    onQueueAction={onQueueAction}
                                    onRightClick={onRightClick}
                                />
                            )
                        }
                        style={{ flex: 1 }}
                        recycleItems
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 8 }}
                    />
                )}
            </Table>
            {state.status === "error" ? (
                <Text className={cn("text-xs text-red-200", listItemStyles.text.muted)}>
                    {state.error || "Failed to load tracks."}
                </Text>
            ) : null}
        </View>
    );
};

export function MediaLibraryDetailView() {
    const detail = useValue(libraryUI$.selectedDetail);
    const searchQuery = useValue(libraryUI$.searchQuery);
    const allTracks = useValue(library$.tracks);
    const spotifyEnabled = useValue(isSpotifySearchEnabled$);
    const appleMusicEnabled = useValue(isAppleMusicSearchEnabled$);
    const heading = getDetailHeading(detail);

    const localTracks = useMemo(
        () => filterTracksByQuery(filterLocalTracks(allTracks, detail), searchQuery),
        [allTracks, detail, searchQuery],
    );

    const [spotifyState, setSpotifyState] = useState<SectionState>(toSectionState("idle"));
    const [appleMusicState, setAppleMusicState] = useState<SectionState>(toSectionState("idle"));

    useEffect(() => {
        if (!detail) {
            setSpotifyState(toSectionState("idle"));
            return;
        }

        if (!spotifyEnabled) {
            setSpotifyState(toSectionState("disabled"));
            return;
        }

        let didCancel = false;
        setSpotifyState(toSectionState("loading"));

        void (async () => {
            try {
                const providerTracks =
                    detail.type === "artist"
                        ? await fetchSpotifyArtistTracks(detail.name, { maxResults: SPOTIFY_DETAIL_MAX_RESULTS })
                        : await fetchSpotifyAlbumTracks(detail.name, {
                              artist: detail.artist ?? null,
                              maxResults: SPOTIFY_DETAIL_MAX_RESULTS,
                          });
                if (didCancel) {
                    return;
                }
                const mapped = providerTracks.map((track, index) => buildSpotifyLocalTrack(track, { index }));
                setSpotifyState({ status: "ready", tracks: mapped, error: null });
            } catch (error) {
                if (didCancel) {
                    return;
                }
                const message = error instanceof Error ? error.message : "Failed to load Spotify tracks";
                setSpotifyState({ status: "error", tracks: [], error: message });
            }
        })();

        return () => {
            didCancel = true;
        };
    }, [detail, spotifyEnabled]);

    useEffect(() => {
        if (!detail) {
            setAppleMusicState(toSectionState("idle"));
            return;
        }

        if (!appleMusicEnabled) {
            setAppleMusicState(toSectionState("disabled"));
            return;
        }

        let didCancel = false;
        setAppleMusicState(toSectionState("loading"));

        void (async () => {
            try {
                const providerTracks =
                    detail.type === "artist"
                        ? await fetchAppleMusicArtistTracks(detail.name)
                        : await fetchAppleMusicAlbumTracks(detail.name, { artist: detail.artist ?? null });
                if (didCancel) {
                    return;
                }
                const mapped = providerTracks.map((track, index) => buildAppleMusicLocalTrack(track, { index }));
                setAppleMusicState({ status: "ready", tracks: mapped, error: null });
            } catch (error) {
                if (didCancel) {
                    return;
                }
                const message = error instanceof Error ? error.message : "Failed to load Apple Music tracks";
                setAppleMusicState({ status: "error", tracks: [], error: message });
            }
        })();

        return () => {
            didCancel = true;
        };
    }, [appleMusicEnabled, detail]);

    const spotifyFiltered = useMemo(
        () => filterTracksByQuery(spotifyState.tracks, searchQuery),
        [searchQuery, spotifyState.tracks],
    );
    const appleMusicFiltered = useMemo(
        () => filterTracksByQuery(appleMusicState.tracks, searchQuery),
        [appleMusicState.tracks, searchQuery],
    );

    const handleQueueAction = useCallback((track: LocalTrack, event?: NativeMouseEvent) => {
        if (event?.shiftKey) {
            audioControls.queue.append(track);
            return;
        }

        const action = getQueueAction({ event });
        if (action === "play-now") {
            audioControls.queue.insertNext(track, { playImmediately: true });
            return;
        }
        if (action === "play-next") {
            audioControls.queue.insertNext(track);
            return;
        }
        audioControls.queue.append(track);
    }, []);

    const handleRowContextMenu = useCallback(async (track: LocalTrack, event: NativeMouseEvent) => {
        const x = event.pageX ?? event.x ?? 0;
        const y = event.pageY ?? event.y ?? 0;
        const menuItems = buildTrackContextMenuItems({ track, includeQueueActions: true });
        if (menuItems.length === 0) {
            return;
        }

        const selection = await showContextMenu(menuItems, { x, y });
        await handleTrackContextMenuSelection({
            selection,
            track,
            onQueueAction: (action) => {
                if (action === "play-next") {
                    audioControls.queue.insertNext(track);
                    return;
                }
                audioControls.queue.append(track);
            },
        });
    }, []);

    if (!detail) {
        return (
            <View className="flex-1 items-center justify-center">
                <Text className="text-sm text-white/60">Pick an artist or album to view details.</Text>
            </View>
        );
    }

    const backView = "library";
    const backLabel = "Back to Library";

    return (
        <View className="flex-1 min-h-0 gap-4 px-4 py-4">
            <View className="flex-row items-center justify-between">
                <View>
                    <Text className="text-lg font-semibold text-white">{heading.title}</Text>
                    {heading.subtitle ? (
                        <Text className="text-xs text-white/60 mt-0.5">{heading.subtitle}</Text>
                    ) : null}
                </View>
                <Button variant="secondary" size="small" onClick={() => selectLibraryView(backView)}>
                    <View className="flex-row items-center gap-2">
                        <Icon name="chevron.left" size={12} color="white" />
                        <Text className="text-sm text-white">{backLabel}</Text>
                    </View>
                </Button>
            </View>

            <View className="flex-1 min-h-0 gap-4">
                <DetailSection
                    title="Local Library"
                    state={{ status: "ready", tracks: localTracks }}
                    filteredTracks={localTracks}
                    onQueueAction={handleQueueAction}
                    onRightClick={handleRowContextMenu}
                />
                <DetailSection
                    title="Spotify"
                    state={spotifyState}
                    filteredTracks={spotifyFiltered}
                    onQueueAction={handleQueueAction}
                    onRightClick={handleRowContextMenu}
                    columns={spotifyTableColumns}
                    renderRow={(item, index) => (
                        <SpotifyTrackRow
                            track={item}
                            index={index}
                            columns={spotifyTableColumns}
                            onQueueAction={handleQueueAction}
                            onRightClick={handleRowContextMenu}
                        />
                    )}
                />
                <DetailSection
                    title="Apple Music"
                    state={appleMusicState}
                    filteredTracks={appleMusicFiltered}
                    onQueueAction={handleQueueAction}
                    onRightClick={handleRowContextMenu}
                />
            </View>
        </View>
    );
}
