import { useObservable } from "@legendapp/state/react";
import { synced } from "@legendapp/state/sync";
import { View } from "react-native";

import { GithubLabelWithDropdown, GithubLabelWithDropdownMultiple } from "@/components/GithubLabelWithDropdown";
import { GithubUserWithDropdown, GithubUserWithDropdownMultiple } from "@/components/GithubUserWithDropdown";
import { issues$ } from "@/sync/StateGithub";
import { arrayRemove } from "@/utils/arrayRemove";
import { getGithubLabels } from "@/utils/github";
import type { GitHubIssue, GitHubLabel, GitHubUser } from "../sync/github";

type IssueDetailMetaProps = {
    issue: GitHubIssue;
};

const OpenColor = "#2da44e";
const ClosedColor = "#8250df";

const AllStates: GitHubLabel[] = [
    { name: "Open", color: OpenColor },
    { name: "Closed", color: ClosedColor },
];

export function IssueDetailMeta({ issue }: IssueDetailMetaProps) {
    const allLabels = getGithubLabels(issue);
    const issue$ = issues$[issue.repo].issues[issue.id];
    const labelsArr$ = issue$.labels;
    const selectedUsers$ = useObservable<GitHubUser[]>(
        [],
        // (issue.assignees || []).reduce(
        //     (acc, user) => {
        //         acc[user.login] = true;
        //         return acc;
        //     },
        //     {} as Record<string, boolean>,
        // ),
    );

    const { assignees, repo: repoName } = issue;
    const selectedStatus$ = useObservable<GitHubLabel>(
        synced({
            get: () => {
                const state = issue$.state.get();
                return {
                    name: state === "open" ? "Open" : "Closed",
                    color: state === "open" ? OpenColor : ClosedColor,
                };
            },
            set: ({ value }) => {
                issue$.state.set(value.name.toLowerCase());
            },
        }),
    );

    return (
        <View className="mt-2 mb-4">
            <View className="flex-row items-center gap-x-3 gap-y-2 flex-wrap">
                {/* Status */}
                <View className="pt-1">
                    <GithubLabelWithDropdown
                        selected$={selectedStatus$}
                        placeholder="+ Status"
                        allItems={AllStates}
                        repoName={repoName}
                        unstyled
                    />
                </View>

                {/* Tags/Labels */}
                <View className="flex-row flex-wrap gap-x-1 gap-y-2">
                    {allLabels.length > 0 ? (
                        allLabels.map((label, index) => (
                            <GithubLabelWithDropdownMultiple
                                key={index}
                                selectedItems$={labelsArr$}
                                repoName={repoName}
                            />
                        ))
                    ) : (
                        <GithubLabelWithDropdownMultiple
                            placeholder="+ Label"
                            selectedItems$={labelsArr$}
                            repoName={repoName}
                        />
                    )}
                </View>

                {/* Assignees */}
                <View className="flex-row items-center gap-2">
                    {assignees && assignees.length > 0 ? (
                        <View className="flex-row">
                            {assignees.map((assignee) => (
                                <GithubUserWithDropdown
                                    key={assignee.login}
                                    repoName={repoName}
                                    selected={assignee}
                                    onSelectItem={(user) => {
                                        arrayRemove(selectedUsers$, user);
                                    }}
                                />
                            ))}
                        </View>
                    ) : (
                        <GithubUserWithDropdownMultiple
                            placeholder="+ Assign"
                            selectedItems$={selectedUsers$}
                            repoName={repoName}
                        />
                    )}
                </View>
            </View>
        </View>
    );
}
