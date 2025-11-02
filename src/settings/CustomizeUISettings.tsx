import { Fragment, useEffect, useMemo } from "react";
import { Text, View } from "react-native";

import { DragDropProvider, DraggableItem, DroppableZone } from "@/components/dnd";
import { useBottomBarControlLayout, usePlaybackControlLayout } from "@/hooks/useUIControls";
import { SettingsPage, SettingsSection } from "@/settings/components";
import {
    settings$,
    type BottomBarControlId,
    type PlaybackControlId,
    type UIControlLayout,
} from "@/systems/Settings";
import { Icon } from "@/systems/Icon";
import { cn } from "@/utils/cn";
import type { SFSymbols } from "@/types/SFSymbols";

type ControlGroup = "shown" | "hidden";
type ControlSectionType = "playback" | "bottomBar";

type ControlDragData<T extends string> = {
    section: ControlSectionType;
    controlId: T;
    group: ControlGroup;
};

interface ControlDefinition<T extends string> {
    id: T;
    label: string;
    description: string;
    icon: SFSymbols;
}

const PLAYBACK_CONTROL_DEFINITIONS: ControlDefinition<PlaybackControlId>[] = [
    {
        id: "previous",
        label: "Previous",
        description: "Skip to the previous track",
        icon: "backward.end.fill",
    },
    {
        id: "playPause",
        label: "Play / Pause",
        description: "Toggle playback",
        icon: "playpause",
    },
    {
        id: "next",
        label: "Next",
        description: "Advance to the next track",
        icon: "forward.end.fill",
    },
    {
        id: "shuffle",
        label: "Shuffle",
        description: "Toggle shuffle mode",
        icon: "shuffle",
    },
    {
        id: "repeat",
        label: "Repeat",
        description: "Cycle repeat modes",
        icon: "repeat",
    },
];

const BOTTOM_BAR_CONTROL_DEFINITIONS: ControlDefinition<BottomBarControlId>[] = [
    {
        id: "savePlaylist",
        label: "Save Playlist",
        description: "Export the current queue",
        icon: "square.and.arrow.down",
    },
    {
        id: "toggleVisualizer",
        label: "Visualizer",
        description: "Show or hide the visualizer",
        icon: "waveform",
    },
    {
        id: "toggleLibrary",
        label: "Library",
        description: "Open or close the media library",
        icon: "sidebar.right",
    },
];

const PLAYBACK_CONTROL_MAP = Object.fromEntries(
    PLAYBACK_CONTROL_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<PlaybackControlId, ControlDefinition<PlaybackControlId>>;

const BOTTOM_BAR_CONTROL_MAP = Object.fromEntries(
    BOTTOM_BAR_CONTROL_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<BottomBarControlId, ControlDefinition<BottomBarControlId>>;

const PLAYBACK_DRAG_ZONE_ID = "customize-playback-controls";
const BOTTOM_BAR_DRAG_ZONE_ID = "customize-bottom-bar";

export function CustomizeUISettings() {
    const playbackLayout = usePlaybackControlLayout();
    const bottomBarLayout = useBottomBarControlLayout();

    useEffect(() => {
        ensureLayoutCompleteness("playback", playbackLayout, PLAYBACK_CONTROL_DEFINITIONS);
    }, [playbackLayout]);

    useEffect(() => {
        ensureLayoutCompleteness("bottomBar", bottomBarLayout, BOTTOM_BAR_CONTROL_DEFINITIONS);
    }, [bottomBarLayout]);

    const normalizedPlaybackLayout = useNormalizedLayout(playbackLayout, PLAYBACK_CONTROL_DEFINITIONS);
    const normalizedBottomBarLayout = useNormalizedLayout(bottomBarLayout, BOTTOM_BAR_CONTROL_DEFINITIONS);

    return (
        <SettingsPage
            title="Customize UI"
            description="Select which controls are visible and arrange their order for the playback toolbar and bottom bar."
        >
            <DragDropProvider>
                <View className="flex flex-col gap-8">
                    <SettingsSection
                        title="Playback Controls"
                        description="Drag controls between Shown and Hidden to curate the playback toolbar."
                    >
                        <ControlLayoutEditor
                            section="playback"
                            layout={normalizedPlaybackLayout}
                            definitions={PLAYBACK_CONTROL_MAP}
                        />
                    </SettingsSection>

                    <SettingsSection
                        title="Bottom Bar"
                        description="Organize shortcuts shown next to the playlist selector."
                    >
                        <ControlLayoutEditor
                            section="bottomBar"
                            layout={normalizedBottomBarLayout}
                            definitions={BOTTOM_BAR_CONTROL_MAP}
                        />
                    </SettingsSection>
                </View>
            </DragDropProvider>
        </SettingsPage>
    );
}

function useNormalizedLayout<T extends string>(
    layout: UIControlLayout<T>,
    definitions: ControlDefinition<T>[],
): UIControlLayout<T> {
    return useMemo(() => {
        const allIds = definitions.map((definition) => definition.id);
        const shown = layout.shown.filter((id): id is T => allIds.includes(id));
        const hidden = layout.hidden.filter((id): id is T => allIds.includes(id));
        const missing = allIds.filter((id) => !shown.includes(id) && !hidden.includes(id));

        return {
            shown,
            hidden: [...hidden, ...missing],
        };
    }, [layout.hidden, layout.shown, definitions]);
}

function ensureLayoutCompleteness<T extends string>(
    section: ControlSectionType,
    layout: UIControlLayout<T>,
    definitions: ControlDefinition<T>[],
) {
    const allIds = definitions.map((definition) => definition.id);
    const present = new Set<T>([...layout.shown, ...layout.hidden]);
    const missing = allIds.filter((id) => !present.has(id));

    if (missing.length === 0) {
        return;
    }

    const sanitizedLayout: UIControlLayout<T> = {
        shown: layout.shown.filter((id): id is T => allIds.includes(id)),
        hidden: [...layout.hidden.filter((id): id is T => allIds.includes(id)), ...missing],
    };

    if (section === "playback") {
        settings$.ui.playback.set(sanitizedLayout as UIControlLayout<PlaybackControlId>);
    } else {
        settings$.ui.bottomBar.set(sanitizedLayout as UIControlLayout<BottomBarControlId>);
    }
}

interface ControlLayoutEditorProps<T extends string> {
    section: ControlSectionType;
    layout: UIControlLayout<T>;
    definitions: Record<T, ControlDefinition<T>>;
}

function ControlLayoutEditor<T extends string>({ section, layout, definitions }: ControlLayoutEditorProps<T>) {
    const handleMove = (params: MoveControlParams<T>) => {
        moveControl(params);
    };

    const shownItems = layout.shown;
    const hiddenItems = layout.hidden;
    const dragZoneId = section === "playback" ? PLAYBACK_DRAG_ZONE_ID : BOTTOM_BAR_DRAG_ZONE_ID;

    return (
        <View className="flex flex-col gap-6">
            <ControlGroup
                label="Shown"
                items={shownItems}
                emptyHint="Drag controls here to make them visible"
                group="shown"
                section={section}
                definitions={definitions}
                onMove={handleMove}
            />
            <ControlGroup
                label="Hidden"
                items={hiddenItems}
                emptyHint="No hidden controls"
                group="hidden"
                section={section}
                definitions={definitions}
                onMove={handleMove}
            />
        </View>
    );
}

interface ControlGroupProps<T extends string> {
    label: string;
    items: T[];
    emptyHint: string;
    group: ControlGroup;
    section: ControlSectionType;
    definitions: Record<T, ControlDefinition<T>>;
    onMove: (params: MoveControlParams<T>) => void;
}

function ControlGroup<T extends string>({
    label,
    items,
    emptyHint,
    group,
    section,
    definitions,
    onMove,
}: ControlGroupProps<T>) {
    const zoneId = section === "playback" ? PLAYBACK_DRAG_ZONE_ID : BOTTOM_BAR_DRAG_ZONE_ID;

    return (
        <View className="flex flex-col gap-3">
            <Text className="text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary">{label}</Text>
            <View className="rounded-2xl border border-border-primary bg-white/5 px-4 py-4">
                <ControlDropZone targetGroup={group} section={section} index={0} onMove={onMove} />
                {items.map((controlId, index) => (
                    <Fragment key={`${group}-${controlId}`}>
                        <DraggableItem<ControlDragData<T>>
                            id={`${section}-${controlId}`}
                            zoneId={zoneId}
                            data={() => ({ controlId, section, group })}
                            className="w-full"
                        >
                            <ControlChip definition={definitions[controlId]} />
                        </DraggableItem>
                        <ControlDropZone targetGroup={group} section={section} index={index + 1} onMove={onMove} />
                    </Fragment>
                ))}
                {items.length === 0 ? (
                    <Text className="text-center text-xs text-text-tertiary py-2">{emptyHint}</Text>
                ) : null}
            </View>
        </View>
    );
}

interface ControlDropZoneProps<T extends string> {
    section: ControlSectionType;
    targetGroup: ControlGroup;
    index: number;
    onMove: (params: MoveControlParams<T>) => void;
}

function ControlDropZone<T extends string>({ section, targetGroup, index, onMove }: ControlDropZoneProps<T>) {
    const dropId = `${section}-${targetGroup}-drop-${index}`;

    return (
        <DroppableZone
            id={dropId}
            allowDrop={(item) => {
                const payload = item.data as ControlDragData<T>;
                return payload.section === section;
            }}
            onDrop={(item) => {
                const payload = item.data as ControlDragData<T>;
                onMove({
                    section,
                    controlId: payload.controlId,
                    sourceGroup: payload.group,
                    targetGroup,
                    targetIndex: index,
                });
            }}
            className="my-1 h-4"
            activeClassName="opacity-100"
        >
            {(isActive) => (
                <View
                    className={cn(
                        "h-full rounded-full bg-emerald-500/40 transition-opacity",
                        isActive ? "opacity-100" : "opacity-0",
                    )}
                />
            )}
        </DroppableZone>
    );
}

interface ControlChipProps<T extends string> {
    definition: ControlDefinition<T>;
}

function ControlChip<T extends string>({ definition }: ControlChipProps<T>) {
    return (
        <View className="flex-row items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            <View className="rounded-lg bg-white/10 p-2">
                <Icon name={definition.icon} size={14} color="#fff" />
            </View>
            <View className="flex-1">
                <Text className="text-sm font-semibold text-text-primary">{definition.label}</Text>
                <Text className="text-xs text-text-secondary">{definition.description}</Text>
            </View>
        </View>
    );
}

interface MoveControlParams<T extends string> {
    section: ControlSectionType;
    controlId: T;
    sourceGroup: ControlGroup;
    targetGroup: ControlGroup;
    targetIndex: number;
}

function moveControl<T extends string>({ section, controlId, sourceGroup, targetGroup, targetIndex }: MoveControlParams<T>) {
    const layout = (section === "playback"
        ? (settings$.ui.playback.get() as UIControlLayout<T>)
        : (settings$.ui.bottomBar.get() as UIControlLayout<T>));

    const originalShownIndex = layout.shown.indexOf(controlId);
    const originalHiddenIndex = layout.hidden.indexOf(controlId);

    const filteredShown = layout.shown.filter((id) => id !== controlId);
    const filteredHidden = layout.hidden.filter((id) => id !== controlId);

    const isSameGroup = sourceGroup === targetGroup;
    const originalIndex = sourceGroup === "shown" ? originalShownIndex : originalHiddenIndex;

    let insertIndex = targetIndex;
    if (isSameGroup && originalIndex !== -1 && originalIndex < targetIndex) {
        insertIndex = Math.max(0, targetIndex - 1);
    }

    const targetArray = targetGroup === "shown" ? filteredShown : filteredHidden;
    const boundedIndex = Math.max(0, Math.min(insertIndex, targetArray.length));
    targetArray.splice(boundedIndex, 0, controlId);

    const nextLayout: UIControlLayout<T> = {
        shown: targetGroup === "shown" ? targetArray : filteredShown,
        hidden: targetGroup === "hidden" ? targetArray : filteredHidden,
    };

    if (section === "playback") {
        settings$.ui.playback.set(nextLayout as UIControlLayout<PlaybackControlId>);
    } else {
        settings$.ui.bottomBar.set(nextLayout as UIControlLayout<BottomBarControlId>);
    }
}
