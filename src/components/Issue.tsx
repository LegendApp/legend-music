import { use$ } from "@legendapp/state/react";
import { Text, View } from "react-native";

import { GithubLabel } from "@/components/GithubLabel";
import { issues$ } from "@/sync/StateGithub";
import { cn } from "@/utils/cn";
import { getGithubLabels } from "@/utils/github";
import { formatRelativeDate } from "@/utils/utils";
import type { GitHubIssue } from "../sync/github";

export const Issue = ({ issue, isSelected }: { issue: GitHubIssue; isSelected: boolean }) => {
    const issue$ = issues$[issue.repo].issues[issue.id];
    const allLabels = use$(() => getGithubLabels(issue$.get()));

    return (
        <View className={cn("p-3 rounded-lg", isSelected ? "bg-background-tertiary" : "bg-background-secondary")}>
            <View className="flex-row items-center">
                {/* <View
                    className={`w-3 h-3 rounded-full mr-2 ${
                        issue.state === 'open' ? 'bg-green-500' : 'bg-purple-500'
                    } items-center justify-center`}
                >
                    <Text className="text-text-primary text-[8px]">{issue.state === 'open' ? '!' : '✓'}</Text>
                </View> */}
                <Text className="text-base font-medium text-text-primary flex-1" numberOfLines={1} ellipsizeMode="tail">
                    {issue.title}
                </Text>
                <Text className="text-xs text-text-tertiary pl-3">{issue.comments + 1}</Text>
            </View>

            <View className="flex-row mt-2 items-center justify-between">
                <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-text-tertiary">#{issue.number}</Text>
                    <Text className="text-xs text-text-tertiary">{issue.user.login}</Text>
                </View>
                <Text className="text-xs text-text-tertiary justify-self-end">
                    {formatRelativeDate(issue.updated_at)}
                </Text>
            </View>

            {/* Labels section */}
            <View className="flex-row flex-wrap mt-3">
                <View className="flex-row flex-wrap flex-1 gap-x-1 gap-y-2">
                    {allLabels.map((label, index) => (
                        <GithubLabel key={index} name={label.name} color={label.color} className="mr-1 -mt-0.5" />
                    ))}
                </View>
                <Text className="text-xs text-text-tertiary ml-2">{formatRelativeDate(issue.created_at)}</Text>
            </View>
        </View>
    );
};
