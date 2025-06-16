import { Text, View } from "react-native";

import { GithubAvatar } from "@/components/GithubAvatar";
import type { GitHubUser } from "@/sync/github";
import { cn } from "@/utils/cn";

interface GithubUserProps {
    user: GitHubUser;
    className?: string;
    textClassName?: string;
}

export function GithubUser({ user, className = "", textClassName = "" }: GithubUserProps) {
    return (
        <View className={cn("flex-row items-center gap-x-2", className)}>
            <GithubAvatar user={user} size="size-5" />
            <Text className={cn("text-text-primary text-xs", textClassName)}>{user.login}</Text>
        </View>
    );
}
