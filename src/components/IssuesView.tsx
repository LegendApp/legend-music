import { useMemo } from "react";
import { View } from "react-native";

import { DisplayOptions } from "@/components/DisplayOptions";
import { Filters } from "@/components/Filters";
import { IssuesBoard } from "@/components/IssuesBoard";
import { IssuesList } from "@/components/IssuesList";
import { SearchFilters } from "@/components/SearchFilters";
import { getSelectedTab$, useSelectedTab } from "@/systems/Settings";
import { cn } from "@/utils/cn";
import type { GitHubIssue } from "../sync/github";

export const IssuesView = ({ issues }: { issues: GitHubIssue[] }) => {
    // Get the selected view from settings
    const selectedTab = useSelectedTab();
    const tab$ = getSelectedTab$();

    // Initialize mode from selected tab or default to 'List'
    const mode = selectedTab?.viewMode;

    const topBar = useMemo(() => {
        return (
            <View className={cn("flex-row items-center justify-between", mode === "Board" && "flex-1")}>
                {mode === "List" ? (
                    <View className="p-3 gap-y-2 border-b border-border-primary flex-1">
                        <SearchFilters searchQuery$={tab$.search} />
                        <View className="flex-row items-center gap-x-2 gap-y-2 flex-wrap">
                            <DisplayOptions supportGrouping={false} />
                            <Filters />
                        </View>
                    </View>
                ) : (
                    <View className="flex-row items-center flex-1 gap-x-1">
                        <SearchFilters
                            searchQuery$={tab$.search}
                            containerClassName="flex-row items-center border-b-0"
                            searchContainerClassName="w-60"
                        />
                        <DisplayOptions supportGrouping />
                        <Filters />
                    </View>
                )}
            </View>
        );
    }, [mode]);

    const Component = mode === "List" ? IssuesList : IssuesBoard;

    return (
        <View className="flex-1 bg-background-primary">
            <Component issues={issues} topBar={topBar} />
        </View>
    );
};
