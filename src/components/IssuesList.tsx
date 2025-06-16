import { LegendList } from "@legendapp/list";
import { use$ } from "@legendapp/state/react";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { filterIssues, sortIssues } from "@/systems/IssueFilters";
import { measureNavTime } from "@/systems/NavTime";
import { getSelectedTab$, useSelectedTab } from "@/systems/Settings";
import { state$ } from "@/systems/State";
import type { GitHubIssue } from "../sync/github";
import { Button } from "./Button";
import { Issue } from "./Issue";

const IssueCard = ({ issue, className }: { issue: GitHubIssue; className?: string }) => {
    const selectedIssue$ = state$.selectedIssue;
    const isSelected = use$(() => {
        const selectedIssue = selectedIssue$.get();
        return selectedIssue?.id === issue.id && selectedIssue?.repo === issue.repo;
    });
    return (
        <Button
            onPress={() => {
                selectedIssue$.assign({ id: issue.id, repo: issue.repo });
            }}
            className={className}
        >
            <Issue issue={issue} isSelected={isSelected} />
        </Button>
    );
};

export const IssuesList = ({ issues, topBar }: { issues: GitHubIssue[]; topBar: React.ReactNode }) => {
    useEffect(measureNavTime, []);

    const tab = useSelectedTab();
    const tab$ = getSelectedTab$();
    const filters = use$(tab.filters);
    const displayOptions = use$(tab.displayOptions);

    // Use the shared filtering logic
    const filteredIssues = filterIssues(issues, tab$.search, filters);

    // Segment filtered issues by using the displayOptions
    const sortedIssues = sortIssues(filteredIssues, displayOptions);

    return (
        <View className="flex-1 h-full bg-background-primary">
            {topBar}

            <LegendList
                data={sortedIssues}
                keyExtractor={(item) => `issue-${item.number}`}
                contentContainerStyle={styles.container}
                recycleItems
                renderItem={({ item: issue }) => <IssueCard key={issue.number} issue={issue} />}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 8,
    },
});
