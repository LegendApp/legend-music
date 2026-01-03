import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, Text, useWindowDimensions, View } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";
import { Button } from "@/components/Button";
import type { DropdownMenuRootRef } from "@/components/DropdownMenu";
import { queue$ } from "@/components/AudioPlayer";
import { JumpSearchMenuDropdown } from "@/components/JumpSearchMenuDropdown";
import { usePlaybackControlLayout } from "@/hooks/useUIControls";
import { SUPPORT_PLAYLISTS } from "@/systems/constants";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { library$ } from "@/systems/LibraryState";
import { localMusicState$ } from "@/systems/LocalMusicState";
import type { PlaybackControlId } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import {
    useLibraryToggle,
    usePlaylistOptions,
    usePlaylistQueueHandlers,
    useQueueExporter,
    useVisualizerToggle,
} from "./PlaylistSelector/hooks";

const DEFAULT_BOTTOM_BAR_BUTTONS: PlaybackControlId[] = ["search", "savePlaylist", "toggleVisualizer", "toggleLibrary"];

type PlaylistSelectorProps = {
    variant?: "default" | "overlay";
    className?: string;
};

// TODO: This file isn't used anymore

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

    const playbackLayout = usePlaybackControlLayout();
    const bottomBarControls = (
        (playbackLayout?.shown?.length ? playbackLayout.shown : DEFAULT_BOTTOM_BAR_BUTTONS) as PlaybackControlId[]
    )
        .filter((controlId, index, array) => array.indexOf(controlId) === index)
        .filter((controlId) => DEFAULT_BOTTOM_BAR_BUTTONS.includes(controlId));
    const hasSearchControl = bottomBarControls.includes("search");
    const isOverlayVariant = true; //variant === "overlay";
    const containerClassName = cn(isOverlayVariant ? "" : "px-3 border-t border-white/10", className);
    const rowClassName = cn("flex-row items-center gap-x-1", isOverlayVariant && "justify-end");

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
                                <JumpSearchMenuDropdown
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
                                    variant="icon-hover"
                                    size="xs"
                                    iconSize={14}
                                    iconYOffset={2}
                                    onClick={handleSavePlaylist}
                                    disabled={queue.tracks.length === 0}
                                    tooltip="Save playlist"
                                />
                            ) : null;
                        case "toggleVisualizer": {
                            const icon = isVisualizerOpen ? "waveform.circle.fill" : "waveform";
                            const iconSize = isVisualizerOpen ? 21 : 14;
                            return (
                                <Button
                                    key="toggleVisualizer"
                                    icon={icon}
                                    variant="icon-hover"
                                    size="xs"
                                    iconSize={iconSize}
                                    iconYOffset={1}
                                    onClick={toggleVisualizer}
                                    tooltip={isVisualizerOpen ? "Hide visualizer" : "Show visualizer"}
                                />
                            );
                        }
                        case "toggleLibrary": {
                            const icon: SFSymbol = isLibraryOpen ? "play.square.stack.fill" : "play.square.stack";
                            const iconSize = isLibraryOpen ? 16 : 16;

                            return (
                                <Button
                                    key="toggleLibrary"
                                    icon={icon}
                                    variant={isLibraryOpen ? "icon" : "icon-hover"}
                                    size="xs"
                                    iconSize={iconSize}
                                    iconYOffset={1}
                                    onClick={toggleLibraryWindow}
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
