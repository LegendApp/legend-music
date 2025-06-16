import { use$, useMount } from "@legendapp/state/react";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { filterIssues, segmentIssues } from "@/systems/IssueFilters";
import { measureNavTime } from "@/systems/NavTime";
import { getSelectedTab$, useSelectedTab } from "@/systems/Settings";
import { state$ } from "@/systems/State";
import type { GitHubIssue } from "../sync/github";
import { Button } from "./Button";
import { DragDropProvider, DraggableItem, type DraggedItem, DroppableZone } from "./dnd";
import { Issue } from "./Issue";

const IssueCard = ({
    issue,
    columnId,
    className,
    onSelect,
}: {
    issue: GitHubIssue;
    columnId: string;
    className?: string;
    onSelect: () => void;
}) => {
    const selectedIssue$ = state$.selectedIssue;
    const isSelected = use$(() => {
        const selectedIssue = selectedIssue$.get();
        return selectedIssue?.id === issue.id && selectedIssue?.repo === issue.repo;
    });

    return (
        <DraggableItem id={`issue-${issue.number}`} zoneId={columnId} data={issue}>
            <Button
                onPress={() => {
                    selectedIssue$.assign({ id: issue.id, repo: issue.repo });
                    onSelect();
                }}
                className={className}
            >
                <Issue issue={issue} isSelected={isSelected} />
            </Button>
        </DraggableItem>
    );
};

const EmptyColumnMessage = () => (
    <View className="p-4 items-center">
        <Text className="text-text-secondary">No issues</Text>
    </View>
);

const IssueColumn = ({
    issues,
    title,
    columnId,
    onDrop,
    onSelectIssue,
}: {
    issues: GitHubIssue[];
    title: string;
    columnId: string;
    onDrop: (item: DraggedItem) => void;
    onSelectIssue: () => void;
}) => (
    <DroppableZone
        id={columnId}
        allowDrop={(item) => item.sourceZoneId !== columnId}
        onDrop={onDrop}
        className="w-80 rounded-md"
        activeClassName="bg-background-tertiary"
    >
        <ScrollView contentContainerClassName="pr-3">
            <View className="p-3 border-b border-border-primary">
                <Text className="text-text-primary font-semibold">
                    {title} ({issues.length})
                </Text>
            </View>

            <View className="py-2 gap-y-2">
                {issues.map((issue) => (
                    <IssueCard key={issue.number} issue={issue} columnId={columnId} onSelect={onSelectIssue} />
                ))}
                {issues.length === 0 && <EmptyColumnMessage />}
            </View>
        </ScrollView>
    </DroppableZone>
);

export const IssuesBoard = ({ issues, topBar }: { issues: GitHubIssue[]; topBar: React.ReactNode }) => {
    const [height, setHeight] = useState(0);
    useMount(measureNavTime);
    const tab$ = getSelectedTab$();
    const tab = useSelectedTab();

    const filters = tab.filters;
    const displayOptions = tab.displayOptions;

    // Filter issues using the shared filtering logic
    const filteredIssues = filterIssues(issues, tab$.search, filters);

    // Segment filtered issues by using the displayOptions
    const groupedIssues = segmentIssues(filteredIssues, displayOptions);

    // Handler for when an issue is dropped into a column
    const handleIssueDrop = (targetColumnId: string, item: DraggedItem) => {
        const droppedIssue = item.data as GitHubIssue;
        const newState = targetColumnId === "open" ? "open" : "closed";

        // Here you would update the issue state in your backend/API
        console.log(`Changed issue #${droppedIssue.number} state from ${droppedIssue.state} to ${newState}`);

        // For now, just log the change since we're not implementing the actual API update
    };

    const columns = useMemo(() => {
        // Convert the grouped issues object to an array of columns
        return Object.entries(groupedIssues).map(([key, groupIssues]) => ({
            id: key.toLowerCase(),
            title: key,
            issues: groupIssues,
        }));
    }, [groupedIssues]);

    return (
        <DragDropProvider>
            <View className="flex-1 flex-col overflow-hidden">
                <ScrollView
                    className="flex-1 -mt-5"
                    horizontal
                    contentContainerStyle={{ height: height ? height - 20 : undefined, paddingBottom: 50 }}
                    onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
                >
                    <View>
                        <View className="p-3 border-b border-border-primary flex-row items-center justify-between">
                            {topBar}
                        </View>
                        <View className="flex-row p-3 gap-x-1">
                            {columns.map((column, i) => (
                                <IssueColumn
                                    key={i}
                                    issues={column.issues}
                                    title={column.title}
                                    columnId={column.id}
                                    onDrop={(item) => handleIssueDrop(column.id, item)}
                                    onSelectIssue={() => {}}
                                />
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </DragDropProvider>
    );
};
