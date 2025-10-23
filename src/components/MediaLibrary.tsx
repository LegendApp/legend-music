import { use$ } from "@legendapp/state/react";
import { useRef } from "react";
import { Text, View } from "react-native";

import { Panel, PanelGroup, ResizeHandle } from "@/components/ResizablePanels";
import type { TextInputSearchRef } from "@/components/TextInputSearch";
import { libraryUI$ } from "@/systems/LibraryState";
import { settings$ } from "@/systems/Settings";
import { perfCount } from "@/utils/perfLogger";

import { LibraryTree } from "./MediaLibrary/LibraryTree";
import { MediaLibrarySearchBar } from "./MediaLibrary/SearchBar";
import { TrackList } from "./MediaLibrary/TrackList";

export function MediaLibraryView() {
    perfCount("MediaLibraryView.render");
    const searchQuery = use$(libraryUI$.searchQuery);
    const searchInputRef = useRef<TextInputSearchRef>(null);
    const showHints = use$(settings$.general.showHints);

    return (
        <View className="flex-1 min-w-[360px] min-h-0 bg-black/5 border-l border-white/10">
            <MediaLibrarySearchBar searchInputRef={searchInputRef} query={searchQuery} />
            <View className="flex-1">
                <PanelGroup direction="horizontal">
                    <Panel
                        id="sidebar"
                        minSize={80}
                        maxSize={300}
                        defaultSize={200}
                        order={0}
                        className="border-r border-white/10"
                    >
                        <LibraryTree searchQuery={searchQuery} />
                    </Panel>

                    <ResizeHandle panelId="sidebar" />

                    <Panel id="tracklist" minSize={80} defaultSize={200} order={1} flex>
                        <TrackList searchQuery={searchQuery} />
                    </Panel>
                </PanelGroup>
            </View>
            {showHints ? (
                <View className="border-t border-white/15 bg-black/20 px-3 py-2">
                    <Text className="text-xs text-white/60">Shift click to play next</Text>
                </View>
            ) : null}
        </View>
    );
}
