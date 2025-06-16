import { use$, useObservable, useObserveEffect } from "@legendapp/state/react";
import { useEffect, useRef } from "react";
import { ScrollView, Text, View } from "react-native";

import { GithubAvatar } from "@/components/GithubAvatar";
import { IssueDetailMeta } from "@/components/IssueDetailMeta";
import { measureNavTime } from "@/systems/NavTime";
import { state$ } from "@/systems/State";
import { ShadowSubtle } from "@/utils/styles";
import { formatRelativeDate } from "@/utils/utils";
import { fetchIssueDetails, type GitHubComment } from "../sync/github";
import { CommentEditor } from "./CommentEditor";
import { Markdown } from "./Markdown";

type CommentProps = {
    comment: GitHubComment;
};

const CommentItem = ({ comment }: CommentProps) => {
    return (
        <View className="mb-4 rounded-md bg-background-secondary" style={ShadowSubtle}>
            <View className="rounded-md border border-border-primary overflow-hidden">
                <View className="p-3 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                        <GithubAvatar user={comment.user} size="size-6" />
                        <Text className="font-medium text-text-primary">{comment.user.login}</Text>
                    </View>
                    <Text className="text-sm text-text-tertiary">{formatRelativeDate(comment.created_at)}</Text>
                </View>
                <View className="px-3">
                    <Markdown>{comment.body}</Markdown>
                </View>
            </View>
        </View>
    );
};

export const IssueDetail = () => {
    const refScrollView = useRef<ScrollView>(null);
    const selectedIssue$ = state$.selectedIssue.issue;
    const issue = use$(selectedIssue$);
    useEffect(measureNavTime, [issue]);
    const comments$ = useObservable<GitHubComment[]>([]);
    const comments = use$(comments$);

    useObserveEffect(async () => {
        const issueCurrent = selectedIssue$.get();
        refScrollView.current?.scrollTo({ y: 0, animated: false });
        if (issueCurrent) {
            try {
                const [owner, repo] = issueCurrent.repo.split("/");
                // Fetch issue details including comments
                const details = await fetchIssueDetails(owner, repo, issueCurrent.number);
                if (details) {
                    comments$.set(details.comments);
                }
            } catch (error) {
                console.error("Error fetching issue details:", error);
                comments$.set([]);
            }
        }
    });

    if (!issue) {
        return (
            <View className="flex-1 items-center justify-center bg-background-primary">
                <Text className="text-text-tertiary">Select an issue to view details</Text>
            </View>
        );
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <View className="bg-background-primary flex-1 rounded-r-lg">
            <ScrollView ref={refScrollView}>
                <View className="px-4 pb-4 pt-2 max-w-4xl">
                    {/* Issue Header */}
                    <View className="flex-row items-center mb-2">
                        {/* <View
                            className={`w-6 h-6 rounded-full mr-2 ${
                                issue.state === 'open' ? 'bg-green-500' : 'bg-purple-500'
                            } items-center justify-center`}
                        >
                            <Text className="text-text-primary text-xs">{issue.state === 'open' ? 'Open' : '✓'}</Text>
                        </View> */}
                        <Text className="text-2xl font-bold text-text-primary">{issue.title}</Text>
                    </View>

                    <View className="mb-2">
                        <Text className="text-text-tertiary">
                            #{issue.number} opened on {formatDate(issue.created_at)} by {issue.user.login}
                        </Text>
                    </View>

                    {/* Issue Metadata: Tags/Labels, Status, Assignees */}
                    <IssueDetailMeta issue={issue} />

                    {/* Issue Body */}
                    <View style={ShadowSubtle} className="rounded-md mt-4 bg-background-secondary">
                        <View className="p-4 border border-border-primary rounded-md">
                            <Markdown>{issue.body}</Markdown>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between py-4 px-3 mt-6">
                        <View className="flex-row items-center gap-3">
                            <GithubAvatar user={issue.user} size="size-6" />
                            <Text className="text-sm text-text-tertiary">{issue.user.login} opened this</Text>
                        </View>
                        <Text className="text-sm text-text-tertiary">{formatRelativeDate(issue.created_at)}</Text>
                    </View>

                    {comments.map((comment, index) => (
                        <CommentItem key={index} comment={comment} />
                    ))}

                    {/* Comment Editor */}
                    <CommentEditor issueId={issue.number} />
                </View>
            </ScrollView>
        </View>
    );
};
