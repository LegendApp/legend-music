import type { Observable } from "@legendapp/state";
import { use$ } from "@legendapp/state/react";

import type { DisplayOptionsState } from "@/components/DisplayOptions";
import type { FilterState } from "@/components/Filters";
import { settings$ } from "@/systems/Settings";
import type { GitHubIssue } from "../sync/github";

/**
 * Filters issues based on search query and filter settings
 * @param issues Array of GitHub issues to filter
 * @param searchQuery$ Observable string containing the search query
 * @param filters Filter state or observable to apply
 * @returns Filtered array of issues
 */
export function filterIssues(
    issues: GitHubIssue[],
    searchQuery$: Observable<string>,
    filters: FilterState,
): GitHubIssue[] {
    const searchQuery = use$(searchQuery$);
    // Get actual filter values, handling both regular and observable filters
    const isOpenEnabled = filters.state?.Open || !filters.state?.Closed;
    const isClosedEnabled = filters.state?.Closed || !filters.state?.Open;

    // Check if any label filters are active
    const hasLabelFilters = Object.values(filters.label || {}).some((value) => value);

    // Check if any assignee filters are active
    const hasAssigneeFilters = Object.values(filters.assigned || {}).some((value) => value);

    return issues.filter((issue) => {
        // Filter by search text
        const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase());

        // Filter by issue state (open/closed)
        const matchesFilter =
            (isOpenEnabled && issue.state === "open") || (isClosedEnabled && issue.state === "closed");

        // Filter by labels if any label filters are active
        const matchesLabels =
            !hasLabelFilters ||
            issue.labels.some((label) =>
                Object.entries(filters.label || {}).some(
                    ([filterLabel, isActive]) => isActive && label.name === filterLabel,
                ),
            );

        // Get the first team member as the current user
        const currentUser = settings$.team.get()?.[0]?.login;

        // Filter by assignees if any assignee filters are active
        const matchesAssignees =
            !hasAssigneeFilters ||
            (filters.assigned?.Me &&
                issue.assignees?.some(
                    (assignee) =>
                        // Compare with the current user's login
                        assignee.login === currentUser,
                )) ||
            (filters.assigned?.Other && issue.assignees && issue.assignees.length > 0);

        return matchesSearch && matchesFilter && matchesLabels && matchesAssignees;
    });
}

/**
 * Segments issues by their state (open/closed)
 * @param issues Array of filtered GitHub issues
 * @returns Object containing arrays of open and closed issues
 */
export function segmentIssuesByState(issues: GitHubIssue[]): {
    openIssues: GitHubIssue[];
    closedIssues: GitHubIssue[];
} {
    const openIssues = issues.filter((issue) => issue.state === "open");
    const closedIssues = issues.filter((issue) => issue.state === "closed");

    return { openIssues, closedIssues };
}

export function sortIssues(issues: GitHubIssue[], displayOptions: DisplayOptionsState): GitHubIssue[] {
    const sortedIssues = [...issues].sort((a, b) => {
        let comparison = 0;

        switch (displayOptions.ordering) {
            case "created_at":
                comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                break;
            case "updated_at":
                comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
                break;
            case "comments":
                comparison = (a.comments || 0) - (b.comments || 0);
                break;
            case "title":
                comparison = a.title.localeCompare(b.title);
                break;
        }

        // Apply direction
        return displayOptions.orderDirection === "asc" ? comparison : -comparison;
    });

    return sortedIssues;
}

/**
 * Segments and sorts issues based on display options
 * @param issues Array of filtered GitHub issues
 * @param displayOptions Display options for grouping and sorting
 * @returns Object containing grouped and sorted issues
 */
export function segmentIssues(
    issues: GitHubIssue[],
    displayOptions: DisplayOptionsState,
): Record<string, GitHubIssue[]> {
    // First sort the issues based on ordering and direction
    const sortedIssues = sortIssues(issues, displayOptions);

    // Then group the issues based on grouping option
    const groupedIssues: Record<string, GitHubIssue[]> = {};

    if (displayOptions.grouping === "none") {
        groupedIssues["All Issues"] = sortedIssues;
        return groupedIssues;
    }

    // Group by the selected option
    for (const issue of sortedIssues) {
        let groupKey: string;
        // TODO: Get current user from state
        const currentUser = settings$.team.get()?.[0]?.login;

        switch (displayOptions.grouping) {
            case "state":
                groupKey = issue.state === "open" ? "Open" : "Closed";
                break;
            case "status": {
                // Determine status from labels or default to 'No Status'
                const statusLabel = issue.labels.find((label) => label.name.toLowerCase().includes("status:"));
                groupKey = statusLabel ? statusLabel.name.replace("status:", "").trim() : "No Status";
                break;
            }
            case "label":
                // For issues with no labels, add to 'No Labels' group
                if (issue.labels.length === 0) {
                    groupKey = "No Labels";
                } else {
                    // For issues with labels, add to each label's group
                    for (const label of issue.labels) {
                        const labelKey = label.name;
                        if (!groupedIssues[labelKey]) {
                            groupedIssues[labelKey] = [];
                        }
                        groupedIssues[labelKey].push(issue);
                    }
                    continue; // Skip the final groupedIssues assignment
                }
                break;
            case "assigned":
                if (!issue.assignees || issue.assignees.length === 0) {
                    groupKey = "Unassigned";
                } else if (issue.assignees.some((assignee) => assignee.login === currentUser)) {
                    groupKey = "Assigned to Me";
                } else {
                    groupKey = "Assigned to Others";
                }
                break;
            default:
                groupKey = "Uncategorized";
        }

        if (!groupedIssues[groupKey]) {
            groupedIssues[groupKey] = [];
        }
        groupedIssues[groupKey].push(issue);
    }

    return groupedIssues;
}
