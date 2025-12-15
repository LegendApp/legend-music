import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, Text, useWindowDimensions, View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";
import { Button } from "@/components/Button";
import type { DropdownMenuRootRef } from "@/components/DropdownMenu";
import { queue$ } from "@/components/LocalAudioPlayer";
import { PlaylistSelectorSearchDropdown } from "@/components/PlaylistSelectorSearchDropdown";
import { SelectLegendList } from "@/components/SelectLegendList";
import { useBottomBarControlLayout } from "@/hooks/useUIControls";
import { SUPPORT_PLAYLISTS } from "@/systems/constants";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { library$ } from "@/systems/LibraryState";
import { DEFAULT_LOCAL_PLAYLIST_NAME, localMusicState$ } from "@/systems/LocalMusicState";
import type { BottomBarControlId } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import {
    selectedPlaylist$,
    useLibraryToggle,
    usePlaylistOptions,
    usePlaylistQueueHandlers,
    useQueueExporter,
    useVisualizerToggle,
} from "./PlaylistSelector/hooks";

const DEFAULT_BOTTOM_BAR_BUTTONS: BottomBarControlId[] = [
    "search",
    "savePlaylist",
    "toggleVisualizer",
    "toggleLibrary",
];

type PlaylistSelectorProps = {
    variant?: "default" | "overlay";
    className?: string;
};

export function PlaylistSelector({ variant = "default", className }: PlaylistSelectorProps = {}) {
    const localMusicState = useValue(localMusicState$);
    const library = useValue(library$);
    const queue = useValue(queue$);
    const { width: windowWidth } = useWindowDimensions();
    const [layoutWidth, setLayoutWidth] = useState(0);
    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const nextWidth = event.nativeEvent.layout.width;
        setLayoutWidth((prev) => {
            if (Math.abs(prev - nextWidth) < 1) {
                return prev;
            }
            return nextWidth;
        });
    }, []);
    const baseWidth = layoutWidth > 0 ? layoutWidth : windowWidth;
    const dropdownWidth = Math.max(baseWidth - 16, 320);

    const dropdownMenuRef = useRef<DropdownMenuRootRef>(null);

    const { availablePlaylistIds, playlistMap, tracksByPath } = usePlaylistOptions(localMusicState);
    const { isLibraryOpen, toggleLibraryWindow } = useLibraryToggle();
    const { isVisualizerOpen, toggleVisualizer } = useVisualizerToggle();

    const { handlePlaylistSelect, handleTrackSelect, handleLibraryItemSelect, handleSearchPlaylistSelect } =
        usePlaylistQueueHandlers({
            playlistMap,
            tracksByPath,
            localTracks: localMusicState.tracks,
            libraryTracks: library.tracks,
        });

    const { handleSavePlaylist } = useQueueExporter({ queueTracks: queue.tracks });

    const bottomBarLayout = useBottomBarControlLayout();
    const bottomBarControls = (
        (bottomBarLayout?.shown?.length ? bottomBarLayout.shown : DEFAULT_BOTTOM_BAR_BUTTONS) as BottomBarControlId[]
    ).filter((controlId, index, array) => array.indexOf(controlId) === index);
    const hasSearchControl = bottomBarControls.includes("search");
    const isOverlayVariant = variant === "overlay";
    const containerClassName = cn(
        isOverlayVariant ? "px-2 py-1" : "px-3 border-t border-white/10",
        className,
    );
    const rowClassName = cn("flex-row items-center", isOverlayVariant && "justify-end gap-2");

    useOnHotkeys(
        hasSearchControl
            ? {
                  Search: () => dropdownMenuRef.current?.open(),
              }
            : {},
    );

    const renderPlaylistItem = useMemo(
        () => (playlistId: string | null, mode: "item" | "preview") => {
            if (!playlistId) return <Text>Null</Text>;
            const playlist = playlistMap.get(playlistId);

            if (!playlist) {
                console.log("Playlist not found:", playlistId);
                return <Text>Null</Text>;
            }

            if (mode === "preview") {
                return <Text className="text-text-secondary group-hover:text-white text-sm">{playlist.name}</Text>;
            }

            return (
                <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-text-primary text-sm font-medium flex-1">{playlist.name}</Text>
                    <Text className="text-text-secondary text-xs">
                        {playlist.count} {playlist.count === 1 ? "track" : "tracks"}
                    </Text>
                </View>
            );
        },
        [playlistMap],
    );

    const renderPlaylistItemText = useMemo(
        () => (playlistId: string | null) => {
            if (!playlistId) return "Null";
            const playlist = playlistMap.get(playlistId);
            return playlist?.name ?? "Null";
        },
        [playlistMap],
    );

    return (
        <View className={containerClassName} onLayout={handleLayout}>
            <View className={rowClassName}>
                {!isOverlayVariant && <View className="flex-1" />}
                {/* <View className="flex-1">
                    <SelectLegendList
                        items={availablePlaylistIds}
                        selected$={selectedPlaylist$}
                        placeholder={DEFAULT_LOCAL_PLAYLIST_NAME}
                        onSelectItem={handlePlaylistSelect}
                        getItemKey={(playlist) => playlist}
                        className="min-h-[200px]"
                        renderItem={renderPlaylistItem}
                        renderItemText={renderPlaylistItemText}
                        unstyled={true}
                        triggerClassName="hover:bg-white/10 rounded-md h-8 px-2"
                        contentMaxHeightClassName="max-h-[600px]"
                        textClassName="text-xs"
                        contentMinWidth={dropdownWidth}
                        contentMaxWidth={dropdownWidth}
                        minContentHeight={200}
                        maxContentHeight={600}
                        contentScrolls={true}
                        directionalHint="topLeftEdge"
                        maxWidthMatchTrigger={true}
                    />
                </View> */}
                {bottomBarControls.map((controlId) => {
                    switch (controlId) {
                        case "search":
                            return (
                                <PlaylistSelectorSearchDropdown
                                    key="search"
                                    ref={dropdownMenuRef}
                                    tracks={localMusicState.tracks}
                                    playlists={localMusicState.playlists}
                                    onSelectTrack={handleTrackSelect}
                                    onSelectLibraryItem={handleLibraryItemSelect}
                                    onSelectPlaylist={handleSearchPlaylistSelect}
                                    dropdownWidth={dropdownWidth}
                                />
                            );
                        case "savePlaylist":
                            return SUPPORT_PLAYLISTS ? (
                                <Button
                                    key="savePlaylist"
                                    icon="square.and.arrow.down"
                                    variant="icon"
                                    size="small"
                                    iconSize={16}
                                    iconYOffset={2}
                                    onClick={handleSavePlaylist}
                                    className="ml-2 hover:bg-white/10"
                                    disabled={queue.tracks.length === 0}
                                    tooltip="Save playlist"
                                />
                            ) : null;
                        case "toggleVisualizer": {
                            const icon = isVisualizerOpen ? "waveform.circle.fill" : "waveform";
                            const iconSize = isVisualizerOpen ? 23 : 16;
                            return (
                                <Button
                                    key="toggleVisualizer"
                                    icon={icon}
                                    variant="icon"
                                    size="small"
                                    iconSize={iconSize}
                                    iconYOffset={1}
                                    onClick={toggleVisualizer}
                                    className={cn("ml-2 hover:bg-white/10", isVisualizerOpen && "bg-white/15")}
                                    tooltip={isVisualizerOpen ? "Hide visualizer" : "Show visualizer"}
                                />
                            );
                        }
                        case "toggleLibrary": {
                            const icon: SFSymbol = isLibraryOpen ? "play.square.stack.fill" : "play.square.stack";
                            const iconSize = isLibraryOpen ? 18 : 18;

                            return (
                                <Button
                                    key="toggleLibrary"
                                    icon={icon}
                                    variant="icon"
                                    size="small"
                                    iconSize={iconSize}
                                    iconYOffset={1}
                                    onClick={toggleLibraryWindow}
                                    className={cn("ml-2 hover:bg-white/10", isLibraryOpen && "bg-white/15")}
                                    tooltip={isLibraryOpen ? "Hide library" : "Show library"}
                                />
                            );
                        }
                        default:
                            return null;
                    }
                })}
            </View>
        </View>
    );
}
