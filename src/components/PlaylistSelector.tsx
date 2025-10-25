import { use$ } from "@legendapp/state/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, Text, useWindowDimensions, View } from "react-native";

import { Button } from "@/components/Button";
import type { DropdownMenuRootRef } from "@/components/DropdownMenu";
import { queue$ } from "@/components/LocalAudioPlayer";
import { PlaylistSelectorSearchDropdown } from "@/components/PlaylistSelectorSearchDropdown";
import { SelectLegendList } from "@/components/SelectLegendList";
import { useOnHotkeys } from "@/systems/keyboard/Keyboard";
import { library$ } from "@/systems/LibraryState";
import { localMusicState$ } from "@/systems/LocalMusicState";

import {
    selectedPlaylist$,
    useLibraryToggle,
    usePlaylistOptions,
    usePlaylistQueueHandlers,
    useQueueExporter,
} from "./PlaylistSelector/hooks";

export function PlaylistSelector() {
    const localMusicState = use$(localMusicState$);
    const library = use$(library$);
    const queue = use$(queue$);
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

    const { handlePlaylistSelect, handleTrackSelect, handleLibraryItemSelect, handleSearchPlaylistSelect } =
        usePlaylistQueueHandlers({
            playlistMap,
            tracksByPath,
            localTracks: localMusicState.tracks,
            libraryTracks: library.tracks,
        });

    const { handleSaveQueue } = useQueueExporter({ queueTracks: queue.tracks });

    useOnHotkeys({
        Search: () => dropdownMenuRef.current?.open(),
    });

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

    return (
        <View className="px-1 border-t border-white/10" onLayout={handleLayout}>
            <View className="flex-row items-center">
                <View className="flex-1">
                    <SelectLegendList
                        items={availablePlaylistIds}
                        selected$={selectedPlaylist$}
                        placeholder="Local Files"
                        onSelectItem={handlePlaylistSelect}
                        getItemKey={(playlist) => playlist}
                        className="min-h-[200px]"
                        renderItem={renderPlaylistItem}
                        unstyled={true}
                        triggerClassName="hover:bg-white/10 rounded-md h-8 px-2"
                        contentMaxHeightClassName="max-h-[600px]"
                        contentMinWidth={dropdownWidth}
                        contentMaxWidth={dropdownWidth}
                        minContentHeight={200}
                        maxContentHeight={600}
                        contentScrolls={true}
                        directionalHint="topLeftEdge"
                        maxWidthMatchTrigger={true}
                    />
                </View>
                <PlaylistSelectorSearchDropdown
                    ref={dropdownMenuRef}
                    tracks={localMusicState.tracks}
                    playlists={localMusicState.playlists}
                    onSelectTrack={handleTrackSelect}
                    onSelectLibraryItem={handleLibraryItemSelect}
                    onSelectPlaylist={handleSearchPlaylistSelect}
                    dropdownWidth={dropdownWidth}
                />
                <Button
                    icon="square.and.arrow.down"
                    variant="icon"
                    size="small"
                    iconSize={14}
                    onClick={handleSaveQueue}
                    className="ml-2 hover:bg-white/10"
                    disabled={queue.tracks.length === 0}
                    tooltip="Save queue"
                />
                <Button
                    icon={isLibraryOpen ? "sidebar.right" : "sidebar.right"}
                    variant="icon"
                    size="small"
                    iconSize={14}
                    onClick={toggleLibraryWindow}
                    className={`ml-2 hover:bg-white/10 ${isLibraryOpen ? "bg-white/15" : ""}`}
                    tooltip={isLibraryOpen ? "Hide library" : "Show library"}
                />
            </View>
        </View>
    );
}
