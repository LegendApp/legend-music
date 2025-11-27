import { Fragment, useMemo } from "react";
import { useObserveEffect } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { DragDropProvider, DraggableItem, DroppableZone } from "@/components/dnd";
import { useBottomBarControlLayout, usePlaybackControlLayout } from "@/hooks/useUIControls";
import { SettingsPage, SettingsSection } from "@/settings/components";
import { Icon } from "@/systems/Icon";
import { type BottomBarControlId, type PlaybackControlId, settings$, type UIControlLayout } from "@/systems/Settings";
import type { SFSymbols } from "@/types/SFSymbols";
import { cn } from "@/utils/cn";

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
    // description: string;
    icon: SFSymbols;
}

interface NormalizedUIControlLayout<T extends string> {
    shown: T[];
    hidden: T[];
}

const PLAYBACK_CONTROL_DEFINITIONS: ControlDefinition<PlaybackControlId>[] = [
    {
        id: "previous",
        label: "Previous",
        // description: "Skip to the previous track",
        icon: "backward.end.fill",
    },
    {
        id: "playPause",
        label: "Play / Pause",
        // description: "Toggle playback",
        icon: "play.fill",
    },
    {
        id: "next",
        label: "Next",
        // description: "Advance to the next track",
        icon: "forward.end.fill",
    },
    {
        id: "shuffle",
        label: "Shuffle",
        // description: "Toggle shuffle mode",
        icon: "shuffle",
    },
    {
        id: "repeat",
        label: "Repeat",
        // description: "Cycle repeat modes",
        icon: "repeat",
    },
];

const BOTTOM_BAR_CONTROL_DEFINITIONS: ControlDefinition<BottomBarControlId>[] = [
    {
        id: "search",
        label: "Search",
        // description: "Open the search dialog",
        icon: "magnifyingglass",
    },
    {
        id: "savePlaylist",
        label: "Save Playlist",
        // description: "Export the current queue",
        icon: "square.and.arrow.down",
    },
    {
        id: "toggleVisualizer",
        label: "Visualizer",
        // description: "Show or hide the visualizer",
        icon: "waveform",
    },
    {
        id: "toggleLibrary",
        label: "Library",
        // description: "Open or close the media library",
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

    useObserveEffect(() => {
        ensureLayoutCompleteness("playback", settings$.ui.playback.get(), PLAYBACK_CONTROL_DEFINITIONS);
    });

    useObserveEffect(() => {
        ensureLayoutCompleteness("bottomBar", settings$.ui.bottomBar.get(), BOTTOM_BAR_CONTROL_DEFINITIONS);
    });

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
): NormalizedUIControlLayout<T> {
    return useMemo(() => normalizeLayout(layout, definitions), [layout.shown, definitions]);
}

function normalizeLayout<T extends string>(
    layout: UIControlLayout<T> | undefined,
    definitions: ControlDefinition<T>[],
): NormalizedUIControlLayout<T> {
    const allIds = definitions.map((definition) => definition.id);
    const allowed = new Set(allIds);
    const seen = new Set<T>();
    const shown: T[] = [];

    for (const id of layout?.shown ?? []) {
        if (allowed.has(id) && !seen.has(id)) {
            shown.push(id);
            seen.add(id);
        }
    }

    const hidden = allIds.filter((id) => !seen.has(id));

    return { shown, hidden };
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
    if (a.length !== b.length) {
        return false;
    }

    return a.every((value, index) => value === b[index]);
}

function ensureLayoutCompleteness<T extends string>(
    section: ControlSectionType,
    layout: UIControlLayout<T>,
    definitions: ControlDefinition<T>[],
) {
    const normalized = normalizeLayout(layout, definitions);
    const sanitizedLayout: UIControlLayout<T> = {
        shown: normalized.shown,
    };

    if (arraysEqual(layout?.shown ?? [], sanitizedLayout.shown)) {
        return;
    }

    if (section === "playback") {
        settings$.ui.playback.set(sanitizedLayout as UIControlLayout<PlaybackControlId>);
    } else {
        settings$.ui.bottomBar.set(sanitizedLayout as UIControlLayout<BottomBarControlId>);
    }
}

interface ControlLayoutEditorProps<T extends string> {
    section: ControlSectionType;
    layout: NormalizedUIControlLayout<T>;
    definitions: Record<T, ControlDefinition<T>>;
}

function ControlLayoutEditor<T extends string>({ section, layout, definitions }: ControlLayoutEditorProps<T>) {
    const handleMove = (params: MoveControlParams<T>) => {
        moveControl(params);
    };

    const shownItems = layout.shown;
    const hiddenItems = layout.hidden;

    return (
        <View className="flex flex-col gap-6">
            <ControlGroup
                label="Shown"
                items={shownItems}
                group="shown"
                section={section}
                definitions={definitions}
                onMove={handleMove}
            />
            <ControlGroup
                label="Hidden"
                items={hiddenItems}
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
    group: ControlGroup;
    section: ControlSectionType;
    definitions: Record<T, ControlDefinition<T>>;
    onMove: (params: MoveControlParams<T>) => void;
}

function ControlGroup<T extends string>({ label, items, group, section, definitions, onMove }: ControlGroupProps<T>) {
    const zoneId = section === "playback" ? PLAYBACK_DRAG_ZONE_ID : BOTTOM_BAR_DRAG_ZONE_ID;
    const hasItems = items.length > 0;

    return (
        <View className="flex flex-col gap-3">
            <Text className="text-sm font-semibold text-text-secondary">{label}</Text>
            <View className="rounded-2xl border border-border-primary bg-white/5 py-2">
                <View className={cn("flex flex-row flex-wrap items-center", hasItems ? undefined : "justify-center")}>
                    <ControlDropZone
                        targetGroup={group}
                        section={section}
                        index={0}
                        onMove={onMove}
                        isExpanded={!hasItems}
                    />
                    {items.map((controlId, index) => (
                        <Fragment key={`${group}-${controlId}`}>
                            <DraggableItem<ControlDragData<T>>
                                id={`${section}-${controlId}`}
                                zoneId={zoneId}
                                data={() => ({ controlId, section, group })}
                                className="flex-shrink-0"
                            >
                                <ControlChip definition={definitions[controlId]} />
                            </DraggableItem>
                            {index < items.length - 1 && (
                                <ControlDropZone
                                    targetGroup={group}
                                    section={section}
                                    index={index + 1}
                                    onMove={onMove}
                                />
                            )}
                        </Fragment>
                    ))}
                    {hasItems && (
                        <ControlDropZone
                            targetGroup={group}
                            section={section}
                            index={items.length}
                            onMove={onMove}
                            isExpanded
                        />
                    )}
                </View>
            </View>
        </View>
    );
}

interface ControlDropZoneProps<T extends string> {
    section: ControlSectionType;
    targetGroup: ControlGroup;
    index: number;
    onMove: (params: MoveControlParams<T>) => void;
    isExpanded?: boolean;
}

function ControlDropZone<T extends string>({
    section,
    targetGroup,
    index,
    onMove,
    isExpanded = false,
}: ControlDropZoneProps<T>) {
    const dropId = `${section}-${targetGroup}-drop-${index}`;
    const baseClassName = isExpanded ? "px-2 h-10 flex-1 w-full basis-full" : "h-10 w-2 flex-shrink-0";
    const indicatorClass = isExpanded
        ? "rounded-2xl border border-emerald-500/40 bg-emerald-500/10"
        : "rounded-full bg-emerald-500/40";

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
            className={baseClassName}
            activeClassName="opacity-100"
        >
            {(isActive) => (
                <View
                    className={cn(
                        "h-full w-full transition-opacity",
                        indicatorClass,
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
            <View className="rounded-lg bg-white/10 p-2 pointer-events-none">
                <Icon name={definition.icon} size={14} color="#fff" />
            </View>
            <View className="flex-col max-w-[160px]">
                <Text className="text-xs font-semibold text-text-primary" numberOfLines={1} ellipsizeMode="tail">
                    {definition.label}
                </Text>
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

function moveControl<T extends string>({
    section,
    controlId,
    sourceGroup,
    targetGroup,
    targetIndex,
}: MoveControlParams<T>) {
    const layout =
        section === "playback"
            ? ((settings$.ui.playback.get() as UIControlLayout<T>) ?? { shown: [] })
            : ((settings$.ui.bottomBar.get() as UIControlLayout<T>) ?? { shown: [] });

    const definitions =
        section === "playback"
            ? (PLAYBACK_CONTROL_DEFINITIONS as ControlDefinition<T>[])
            : (BOTTOM_BAR_CONTROL_DEFINITIONS as ControlDefinition<T>[]);

    const normalized = normalizeLayout(layout, definitions);
    const filteredShown = normalized.shown.filter((id) => id !== controlId);

    let nextShown = filteredShown;

    if (targetGroup === "shown") {
        const originalIndex = normalized.shown.indexOf(controlId);
        let insertIndex = targetIndex;

        if (sourceGroup === "shown" && originalIndex !== -1 && originalIndex < targetIndex) {
            insertIndex = Math.max(0, targetIndex - 1);
        }

        const boundedIndex = Math.max(0, Math.min(insertIndex, filteredShown.length));
        nextShown = [...filteredShown];
        nextShown.splice(boundedIndex, 0, controlId);
    }

    const sanitized = normalizeLayout({ shown: nextShown }, definitions);

    if (arraysEqual(normalized.shown, sanitized.shown)) {
        return;
    }

    const nextLayout: UIControlLayout<T> = {
        shown: sanitized.shown,
    };

    if (section === "playback") {
        settings$.ui.playback.set(nextLayout as UIControlLayout<PlaybackControlId>);
    } else {
        settings$.ui.bottomBar.set(nextLayout as UIControlLayout<BottomBarControlId>);
    }
}
